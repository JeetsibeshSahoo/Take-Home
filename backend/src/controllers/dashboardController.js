import { query } from '../db/index.js';
import { calculateDueStatus, getISTDateString } from '../services/interestEngineService.js';

/**
 * GET /api/dashboard/stats
 * Portfolio Dashboard (Tier 2 requirement):
 * - Active loans
 * - Total outstanding principal
 * - Interest accrued today
 * - Overdue count and amount
 * - LTV breach count
 */
export async function getDashboardStats(req, res) {
  try {
    const today = getISTDateString();

    const { rows: activeLoans } = await query(`
      SELECT l.*, a.total_net_weight_grams, a.total_appraised_value_paise,
             a.gold_rate_per_gram_paise as appraisal_gold_rate_paise
      FROM loans l
      JOIN appraisals a ON l.appraisal_id = a.id
      WHERE l.status = 'DISBURSED'
    `);

    // Fetch latest gold rate
    const { rows: rateRows } = await query('SELECT rate_per_gram_paise FROM gold_rates ORDER BY effective_date DESC LIMIT 1');
    const currentRatePaise = rateRows[0]?.rate_per_gram_paise || 700000;

    let totalOutstandingPrincipalPaise = 0;
    let interestAccruedTodayPaise = 0;
    let overdueCount = 0;
    let overdueAmountPaise = 0;
    let ltvBreachCount = 0;

    for (const loan of activeLoans) {
      const principal = Number(loan.outstanding_principal_paise);
      totalOutstandingPrincipalPaise += principal;

      // 1 day's interest on current principal
      const dailyInterest = Math.round((principal * Number(loan.interest_rate_annual_pct)) / 36500);
      interestAccruedTodayPaise += dailyInterest;

      // Overdue check
      const dues = calculateDueStatus(loan, new Date());
      if (dues.isOverdue) {
        overdueCount++;
        overdueAmountPaise += dues.totalDuePaise;
      }

      // Current LTV check against latest rate
      const currentAppraisedPaise = Math.round(
        (Number(loan.total_appraised_value_paise) / Number(loan.appraisal_gold_rate_paise)) * Number(currentRatePaise)
      );
      const currentLtv = (principal / currentAppraisedPaise) * 100;
      const maxLtv = principal <= 20000000 ? 80 : principal <= 50000000 ? 75 : 70;
      if (currentLtv > maxLtv) {
        ltvBreachCount++;
      }
    }

    return res.status(200).json({
      activeLoansCount: activeLoans.length,
      totalOutstandingPrincipalInr: totalOutstandingPrincipalPaise / 100,
      interestAccruedTodayInr: interestAccruedTodayPaise / 100,
      overdueCount,
      overdueAmountInr: overdueAmountPaise / 100,
      ltvBreachCount,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to generate dashboard statistics.' });
  }
}

/**
 * GET /api/dashboard/export-csv
 * CSV export of loans for a date range (Tier 2 requirement)
 */
export async function exportLoansCSV(req, res) {
  try {
    const { startDate, endDate } = req.query;

    let sql = `
      SELECT 
        l.loan_reference_no,
        c.full_name as customer_name,
        c.phone,
        l.scheme,
        (l.principal_paise::numeric / 100) as principal_inr,
        (l.outstanding_principal_paise::numeric / 100) as outstanding_inr,
        l.status,
        TO_CHAR(l.maturity_date, 'YYYY-MM-DD') as maturity_date,
        TO_CHAR(l.created_at, 'YYYY-MM-DD HH24:MI:SS') as sanction_date
      FROM loans l
      JOIN customers c ON l.customer_id = c.id
    `;
    const params = [];

    // Filter by date range only if both dates are provided and non-empty
    if (startDate && endDate && startDate.trim() !== '' && endDate.trim() !== '') {
      sql += ' WHERE l.created_at::date BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }
    sql += ' ORDER BY l.created_at DESC';

    const { rows } = await query(sql, params);

    // Standard CSV Header
    const headerRow = 'Loan Reference,Customer Name,Phone,Scheme,Principal (INR),Outstanding (INR),Status,Maturity Date,Sanction Date';

    // Map each loan record
    const dataRows = rows.map(r =>
      `"${r.loan_reference_no}","${r.customer_name}","${r.phone}","${r.scheme}",${r.principal_inr},${r.outstanding_inr},"${r.status}","${r.maturity_date}","${r.sanction_date}"`
    );

    // Windows Excel standard CRLF line breaks
    const csvContent = [headerRow, ...dataRows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="loans-export.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV export error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to export CSV.' });
  }
}