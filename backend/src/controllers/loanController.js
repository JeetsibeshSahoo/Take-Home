import { getClient, query } from '../db/index.js';
import { validateLoanSanction, validateManagerApproval } from '../services/loanEngineService.js';
import { calculateDueStatus, allocateRepayment, getISTDateString } from '../services/interestEngineService.js';
import { logAudit } from '../services/auditService.js';


function generateLoanReferenceNo(id) {
  const year = new Date().getFullYear();
  return `SWN-${year}-${String(id).padStart(5, '0')}`;
}


export async function sanctionLoan(req, res) {
  const client = await getClient();
  try {
    const { appraisalId, requestedPrincipalInr, scheme, tenureMonths } = req.body;

    if (!appraisalId || !requestedPrincipalInr || !scheme || !tenureMonths) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'appraisalId, requestedPrincipalInr, scheme, and tenureMonths are required.',
      });
    }

    // 1. Fetch appraisal snapshot
    const { rows: appRows } = await client.query(
      'SELECT * FROM appraisals WHERE id = $1',
      [appraisalId]
    );
    if (appRows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Appraisal not found.' });
    }
    const appraisal = appRows[0];

    // Convert requested principal from INR to paise
    const principalPaise = Math.round(Number(requestedPrincipalInr) * 100);

    // 2. Validate loan application against domain rules (LTV, scheme, fees)
    const validation = validateLoanSanction({
      principalPaise,
      appraisedValuePaise: appraisal.total_appraised_value_paise,
      scheme,
      tenureMonths,
    });

    // 3. Compute maturity date based on tenure
    const now = new Date();
    const maturityDate = new Date(now);
    maturityDate.setMonth(maturityDate.getMonth() + Number(tenureMonths));


    const initialStatus = validation.requiresApproval ? 'PENDING_APPROVAL' : 'DISBURSED';
    const disbursedAt = validation.requiresApproval ? null : now;

    await client.query('BEGIN');

    // Insert placeholder row to get ID
    const insertSql = `
      INSERT INTO loans (
        loan_reference_no, customer_id, appraisal_id, scheme,
        interest_rate_annual_pct, tenure_months, principal_paise,
        ltv_percentage, processing_fee_paise, net_disbursal_paise,
        outstanding_principal_paise, status, requires_approval,
        sanctioned_at, disbursed_at, maturity_date, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id;
    `;

    const tempRef = `TEMP-${Date.now()}`;
    const { rows: inserted } = await client.query(insertSql, [
      tempRef,
      appraisal.customer_id,
      appraisal.id,
      validation.scheme,
      validation.annualInterestRatePct,
      Number(tenureMonths),
      validation.principalPaise,
      validation.ltvPercentage,
      validation.processingFeePaise,
      validation.netDisbursalPaise,
      validation.principalPaise, 
      initialStatus,
      validation.requiresApproval,
      now,
      disbursedAt,
      maturityDate.toISOString().split('T')[0],
      req.user.id,
    ]);

    const loanId = inserted[0].id;
    const finalLoanRef = generateLoanReferenceNo(loanId);

    // Update with official reference number
    const { rows: finalRows } = await client.query(
      'UPDATE loans SET loan_reference_no = $1 WHERE id = $2 RETURNING *',
      [finalLoanRef, loanId]
    );
    const loan = finalRows[0];

    // Audit log
    await logAudit({
      entityName: 'LOAN',
      entityId: loan.id,
      action: 'SANCTION',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: {
        loanRef: finalLoanRef,
        principalPaise: loan.principal_paise,
        status: initialStatus,
        requiresApproval: validation.requiresApproval,
      },
      client,
    });

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: validation.requiresApproval
        ? `Loan ${finalLoanRef} created. Awaiting Branch Manager approval (> ₹3,00,000).`
        : `Loan ${finalLoanRef} sanctioned and disbursed successfully.`,
      loan,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Loan sanction error:', err);
    return res.status(400).json({ error: 'Sanction Failed', message: err.message });
  } finally {
    client.release();
  }
}


export async function approveLoan(req, res) {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'APPROVE' or 'REJECT'

    await client.query('BEGIN');

    // Concurrency lock row for approval
    const { rows: loans } = await client.query(
      'SELECT * FROM loans WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (loans.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not Found', message: 'Loan not found.' });
    }

    const loan = loans[0];

    // Validate maker-checker rule
    validateManagerApproval(loan, req.user.id, req.user.role);

    const now = new Date();
    const newStatus = decision === 'APPROVE' ? 'DISBURSED' : 'REJECTED';
    const disbursedAt = decision === 'APPROVE' ? now : null;

    const { rows: updated } = await client.query(
      `UPDATE loans 
       SET status = $1, approved_by_user_id = $2, disbursed_at = $3, updated_at = $4
       WHERE id = $5 RETURNING *`,
      [newStatus, req.user.id, disbursedAt, now, id]
    );

    // Audit log
    await logAudit({
      entityName: 'LOAN',
      entityId: loan.id,
      action: decision === 'APPROVE' ? 'APPROVE_LOAN' : 'REJECT_LOAN',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: { decision, approvedBy: req.user.fullName },
      client,
    });

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Loan ${loan.loan_reference_no} has been ${newStatus.toLowerCase()}.`,
      loan: updated[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve loan error:', err);
    return res.status(400).json({ error: 'Approval Failed', message: err.message });
  } finally {
    client.release();
  }
}


export async function getApprovalsQueue(req, res) {
  try {
    const sql = `
      SELECT 
        l.*,
        c.full_name as customer_name,
        c.phone as customer_phone,
        u.full_name as creator_name
      FROM loans l
      JOIN customers c ON l.customer_id = c.id
      JOIN users u ON l.created_by_user_id = u.id
      WHERE l.status = 'PENDING_APPROVAL'
      ORDER BY l.created_at ASC;
    `;
    const { rows: queue } = await query(sql);
    return res.status(200).json({ queue });
  } catch (err) {
    console.error('Approvals queue error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to fetch approvals queue.' });
  }
}


export async function getDueStatus(req, res) {
  try {
    const { id } = req.params;
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();

    const { rows: loans } = await query(
      `SELECT l.*, c.full_name as customer_name,
        (SELECT payment_date FROM repayments WHERE loan_id = l.id ORDER BY payment_date DESC LIMIT 1) as last_payment_date
       FROM loans l
       JOIN customers c ON l.customer_id = c.id
       WHERE l.id = $1`,
      [id]
    );

    if (loans.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Loan not found.' });
    }

    const loan = loans[0];
    const dueInfo = calculateDueStatus(loan, targetDate);

    return res.status(200).json({
      loanReferenceNo: loan.loan_reference_no,
      status: loan.status,
      calculatedForDate: getISTDateString(targetDate),
      due: dueInfo,
    });
  } catch (err) {
    console.error('Due calculator error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to calculate dues.' });
  }
}


export async function recordRepayment(req, res) {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { amountInr, idempotencyKey, paymentDate } = req.body;

    if (!amountInr || !idempotencyKey) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both amountInr and a unique idempotencyKey are required.',
      });
    }

    const paymentAmountPaise = Math.round(Number(amountInr) * 100);

    // 1. Idempotency Check: Prevent duplicate payment recording
    const { rows: existingPayment } = await client.query(
      'SELECT * FROM repayments WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existingPayment.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Payment was already processed (Idempotent response).',
        repayment: existingPayment[0],
      });
    }

    await client.query('BEGIN');

    // 2. Concurrency Lock: SELECT ... FOR UPDATE
    // Prevents two staff members from updating balances simultaneously!
    const { rows: loans } = await client.query(
      `SELECT l.*,
        (SELECT payment_date FROM repayments WHERE loan_id = l.id ORDER BY payment_date DESC LIMIT 1) as last_payment_date
       FROM loans l
       WHERE l.id = $1 FOR UPDATE`,
      [id]
    );

    if (loans.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not Found', message: 'Loan not found.' });
    }

    const loan = loans[0];

    if (loan.status !== 'DISBURSED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid State',
        message: `Cannot accept repayment for loan in status: ${loan.status}.`,
      });
    }

    // 3. Compute live dues
    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const dueInfo = calculateDueStatus(loan, payDate);

    // 4. Allocate payment (Interest first, then Principal; overpayment rejected)
    const allocation = allocateRepayment({
      paymentAmountPaise,
      outstandingPrincipalPaise: dueInfo.outstandingPrincipalPaise,
      accruedInterestPaise: dueInfo.accruedInterestPaise,
    });

    const paymentRefNo = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 5. Insert repayment record
    const { rows: repRows } = await client.query(
      `INSERT INTO repayments (
        loan_id, payment_reference_no, idempotency_key, amount_paise,
        interest_cleared_paise, principal_cleared_paise,
        outstanding_principal_after_paise, payment_date, recorded_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;`,
      [
        loan.id,
        paymentRefNo,
        idempotencyKey,
        allocation.paymentAmountPaise,
        allocation.interestClearedPaise,
        allocation.principalClearedPaise,
        allocation.remainingPrincipalPaise,
        payDate,
        req.user.id,
      ]
    );
    const repayment = repRows[0];

    // 6. Update loan outstanding principal
    await client.query(
      'UPDATE loans SET outstanding_principal_paise = $1, updated_at = NOW() WHERE id = $2',
      [allocation.remainingPrincipalPaise, loan.id]
    );

    // 7. Audit log inside the transaction
    await logAudit({
      entityName: 'REPAYMENT',
      entityId: repayment.id,
      action: 'PAYMENT',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: {
        paymentRefNo,
        amountInr,
        interestClearedInr: allocation.interestClearedPaise / 100,
        principalClearedInr: allocation.principalClearedPaise / 100,
        remainingPrincipalInr: allocation.remainingPrincipalPaise / 100,
      },
      client,
    });

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Repayment recorded successfully.',
      repayment,
      remainingOutstandingInr: allocation.remainingPrincipalPaise / 100,
      isEligibleForClosure: allocation.remainingPrincipalPaise === 0,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Repayment error:', err);
    return res.status(400).json({ error: 'Repayment Failed', message: err.message });
  } finally {
    client.release();
  }
}


export async function closeLoanAndReleaseGold(req, res) {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { releasedToName, releaseNotes } = req.body;

    if (!releasedToName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name of the person receiving the gold is required.',
      });
    }

    await client.query('BEGIN');

    // Concurrency lock
    const { rows: loans } = await client.query(
      `SELECT l.*,
        (SELECT payment_date FROM repayments WHERE loan_id = l.id ORDER BY payment_date DESC LIMIT 1) as last_payment_date
       FROM loans l WHERE l.id = $1 FOR UPDATE`,
      [id]
    );

    if (loans.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not Found', message: 'Loan not found.' });
    }

    const loan = loans[0];

    // Must be in DISBURSED status to be closed
    if (loan.status !== 'DISBURSED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid State',
        message: `Loan cannot be closed because status is ${loan.status}.`,
      });
    }

    // Check outstanding dues as of right now
    const dues = calculateDueStatus(loan, new Date());
    if (dues.totalDuePaise > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Outstanding Balance Pending',
        message: `Cannot close loan. Outstanding balance is ₹${(dues.totalDuePaise / 100).toFixed(2)}. Balance must be exactly ₹0.`,
      });
    }

    // Fetch gold items summary for release documentation
    const { rows: items } = await client.query(
      'SELECT description, gross_weight_grams, net_weight_grams, karat FROM appraisal_items WHERE appraisal_id = $1',
      [loan.appraisal_id]
    );
    const itemsSummary = items
      .map(i => `${i.description} (${i.karat}K, Net: ${i.net_weight_grams}g)`)
      .join('; ');

    // 1. Record gold release
    const { rows: closures } = await client.query(
      `INSERT INTO loan_closures (
        loan_id, released_by_user_id, gold_released_to_name, released_items_summary
      ) VALUES ($1, $2, $3, $4)
      RETURNING *;`,
      [loan.id, req.user.id, releasedToName.trim(), itemsSummary + (releaseNotes ? ` | Note: ${releaseNotes}` : '')]
    );

    // 2. Mark loan as CLOSED
    await client.query(
      "UPDATE loans SET status = 'CLOSED', updated_at = NOW() WHERE id = $1",
      [loan.id]
    );

    // 3. Audit log
    await logAudit({
      entityName: 'LOAN',
      entityId: loan.id,
      action: 'CLOSE_AND_RELEASE_GOLD',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: {
        releasedTo: releasedToName,
        itemsReleased: itemsSummary,
      },
      client,
    });

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Loan ${loan.loan_reference_no} closed. Gold has been formally released to ${releasedToName}.`,
      closure: closures[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Closure error:', err);
    return res.status(500).json({ error: 'Closure Failed', message: err.message });
  } finally {
    client.release();
  }
}


export async function getLoans(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let countSql = 'SELECT COUNT(*) FROM loans';
    let dataSql = `
      SELECT 
        l.*,
        c.full_name as customer_name,
        c.phone as customer_phone,
        u.full_name as creator_name
      FROM loans l
      JOIN customers c ON l.customer_id = c.id
      JOIN users u ON l.created_by_user_id = u.id
    `;
    const params = [];

    if (status) {
      countSql += ' WHERE status = $1';
      dataSql += ' WHERE l.status = $1';
      params.push(status);
    }

    dataSql += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, offset];

    const [{ rows: countRows }, { rows: loans }] = await Promise.all([
      query(countSql, params),
      query(dataSql, dataParams),
    ]);

    const totalCount = parseInt(countRows[0].count, 10);

    return res.status(200).json({
      loans,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error('Get loans error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve loans.' });
  }
}


export async function getLoanById(req, res) {
  try {
    const { id } = req.params;
    const [{ rows: loans }, { rows: repayments }, { rows: closure }] = await Promise.all([
      query(
        `SELECT l.*, c.full_name as customer_name, c.phone as customer_phone, c.pan as customer_pan,
                u.full_name as creator_name, app_u.full_name as approver_name,
                a.total_gross_weight_grams, a.total_net_weight_grams, a.total_appraised_value_paise
         FROM loans l
         JOIN customers c ON l.customer_id = c.id
         JOIN users u ON l.created_by_user_id = u.id
         LEFT JOIN users app_u ON l.approved_by_user_id = app_u.id
         JOIN appraisals a ON l.appraisal_id = a.id
         WHERE l.id = $1`,
        [id]
      ),
      query(
        `SELECT r.*, u.full_name as recorded_by_name 
         FROM repayments r
         JOIN users u ON r.recorded_by_user_id = u.id
         WHERE r.loan_id = $1 
         ORDER BY r.payment_date DESC`,
        [id]
      ),
      query(
        `SELECT lc.*, u.full_name as released_by_name 
         FROM loan_closures lc
         JOIN users u ON lc.released_by_user_id = u.id
         WHERE lc.loan_id = $1`,
        [id]
      ),
    ]);

    if (loans.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Loan not found.' });
    }

    const loan = loans[0];
    const dueInfo = calculateDueStatus(loan, new Date());

    return res.status(200).json({
      loan: {
        ...loan,
        liveDue: dueInfo,
      },
      repayments,
      closure: closure[0] || null,
    });
  } catch (err) {
    console.error('Get loan by id error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve loan details.' });
  }
}