import { getClient, query } from '../db/index.js';
import { evaluateAppraisal } from '../services/goldAppraisalService.js';
import { logAudit } from '../services/auditService.js';

/**
 * POST /api/appraisals
 * Create an immutable gold appraisal snapshot
 */
export async function createAppraisal(req, res) {
  const client = await getClient();
  try {
    const { customerId, items } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Customer ID and at least one jewelry item are required.',
      });
    }

    // 1. Verify customer exists
    const { rows: customers } = await client.query('SELECT id, full_name FROM customers WHERE id = $1', [customerId]);
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Customer does not exist.' });
    }

    // 2. Fetch latest active gold rate
    const { rows: rates } = await client.query('SELECT * FROM gold_rates ORDER BY effective_date DESC LIMIT 1');
    if (rates.length === 0) {
      return res.status(400).json({ error: 'Missing Rate', message: 'No gold rate set. Admin must set rate first.' });
    }
    const currentRate = rates[0];

    // 3. Evaluate appraisal using domain service
    const evaluation = evaluateAppraisal(items, currentRate.rate_per_gram_paise);

    // Max loan up to 80% (top tier LTV cap)
    const maxEligibleLoanPaise = Math.floor(evaluation.totalAppraisedValuePaise * 0.80);

    // 4. Save inside an ACID transaction
    await client.query('BEGIN');

    const insertAppraisalSql = `
      INSERT INTO appraisals (
        customer_id, gold_rate_id, gold_rate_per_gram_paise,
        total_gross_weight_grams, total_net_weight_grams,
        total_appraised_value_paise, max_eligible_loan_paise,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const { rows: appRows } = await client.query(insertAppraisalSql, [
      customerId,
      currentRate.id,
      currentRate.rate_per_gram_paise,
      evaluation.totalGrossWeightGrams,
      evaluation.totalNetWeightGrams,
      evaluation.totalAppraisedValuePaise,
      maxEligibleLoanPaise,
      req.user.id,
    ]);
    const savedAppraisal = appRows[0];

    // 5. Insert individual items
    for (const item of evaluation.items) {
      await client.query(
        `INSERT INTO appraisal_items (
          appraisal_id, description, gross_weight_grams, stone_weight_grams,
          net_weight_grams, karat, purity_factor, item_value_paise
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          savedAppraisal.id,
          item.description,
          item.grossWeightGrams,
          item.stoneWeightGrams,
          item.netWeightGrams,
          item.karat,
          item.purityFactor,
          item.itemValuePaise,
        ]
      );
    }

    // 6. Audit log inside the transaction
    await logAudit({
      entityName: 'APPRAISAL',
      entityId: savedAppraisal.id,
      action: 'CREATE',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: {
        customerId,
        totalNetWeight: evaluation.totalNetWeightGrams,
        appraisedValuePaise: evaluation.totalAppraisedValuePaise,
        rateUsedPaise: currentRate.rate_per_gram_paise,
      },
      client,
    });

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      appraisal: {
        ...savedAppraisal,
        items: evaluation.items,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Appraisal creation error:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to create appraisal.' });
  } finally {
    client.release();
  }
}

/**
 * GET /api/appraisals/:id
 * Retrieve appraisal snapshot details with items
 */
export async function getAppraisalById(req, res) {
  try {
    const { id } = req.params;
    const [{ rows: appraisals }, { rows: items }] = await Promise.all([
      query(
        `SELECT a.*, c.full_name as customer_name, u.full_name as created_by_name
         FROM appraisals a
         JOIN customers c ON a.customer_id = c.id
         JOIN users u ON a.created_by_user_id = u.id
         WHERE a.id = $1`,
        [id]
      ),
      query('SELECT * FROM appraisal_items WHERE appraisal_id = $1', [id]),
    ]);

    if (appraisals.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Appraisal not found.' });
    }

    return res.status(200).json({
      appraisal: {
        ...appraisals[0],
        items,
      },
    });
  } catch (err) {
    console.error('Get appraisal error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve appraisal.' });
  }
}