import { query } from '../db/index.js';
import { logAudit } from '../services/auditService.js';
import { getISTDateString } from '../services/interestEngineService.js';


export async function getTodayRate(req, res) {
  try {
    // Get today's rate, or the most recent available rate
    const { rows } = await query(
      `SELECT gr.*, u.full_name as set_by_name 
       FROM gold_rates gr
       JOIN users u ON gr.set_by_user_id = u.id
       ORDER BY gr.effective_date DESC 
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No gold rate has been set yet. Please contact an admin.',
      });
    }

    const rate = rows[0];
    return res.status(200).json({
      rate: {
        id: rate.id,
        effectiveDate: rate.effective_date,
        ratePerGramPaise: Number(rate.rate_per_gram_paise),
        ratePerGramInr: Number(rate.rate_per_gram_paise) / 100,
        setByName: rate.set_by_name,
      },
    });
  } catch (err) {
    console.error('Get gold rate error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve gold rate.' });
  }
}


export async function setDailyRate(req, res) {
  try {
    const { ratePerGramInr } = req.body;
    const rateInr = Number(ratePerGramInr);

    if (isNaN(rateInr) || rateInr <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Valid positive rate per gram in INR is required (e.g. 7250).',
      });
    }

    const ratePaise = Math.round(rateInr * 100);
    const today = getISTDateString();

    // Upsert rate for today's date
    const sql = `
      INSERT INTO gold_rates (rate_per_gram_paise, effective_date, set_by_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (effective_date)
      DO UPDATE SET rate_per_gram_paise = EXCLUDED.rate_per_gram_paise, set_by_user_id = EXCLUDED.set_by_user_id
      RETURNING *;
    `;
    const { rows } = await query(sql, [ratePaise, today, req.user.id]);
    const rateRecord = rows[0];

    // Audit log
    await logAudit({
      entityName: 'GOLD_RATE',
      entityId: rateRecord.id,
      action: 'UPDATE_RATE',
      performedByUserId: req.user.id,
      ipAddress: req.ip,
      details: { effectiveDate: today, rateInr, ratePaise },
    });

    return res.status(200).json({
      success: true,
      message: `Gold rate for ${today} set to ₹${rateInr.toLocaleString('en-IN')}/g.`,
      rate: rateRecord,
    });
  } catch (err) {
    console.error('Set gold rate error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to update gold rate.' });
  }
}


export async function getRateHistoryAndBreaches(req, res) {
  try {
    const [{ rows: history }, { rows: breaches }] = await Promise.all([
      query(`
        SELECT gr.*, u.full_name as set_by_name 
        FROM gold_rates gr
        JOIN users u ON gr.set_by_user_id = u.id
        ORDER BY gr.effective_date DESC LIMIT 30
      `),
      // Check active loans whose current LTV exceeds their slab cap based on latest gold rate
      query(`
        WITH latest_rate AS (
          SELECT rate_per_gram_paise FROM gold_rates ORDER BY effective_date DESC LIMIT 1
        ),
        current_appraisals AS (
          SELECT 
            l.id as loan_id,
            l.loan_reference_no,
            l.principal_paise,
            l.outstanding_principal_paise,
            l.ltv_percentage as original_ltv_pct,
            c.full_name as customer_name,
            c.phone as customer_phone,
            a.total_net_weight_grams,
            a.gold_rate_per_gram_paise as original_gold_rate_paise,
            lr.rate_per_gram_paise as current_gold_rate_paise,
            -- Recalculate current value: (original_appraised_value / original_rate) * current_rate
            ROUND((a.total_appraised_value_paise::numeric / a.gold_rate_per_gram_paise) * lr.rate_per_gram_paise) as current_appraised_value_paise
          FROM loans l
          JOIN customers c ON l.customer_id = c.id
          JOIN appraisals a ON l.appraisal_id = a.id
          CROSS JOIN latest_rate lr
          WHERE l.status IN ('DISBURSED', 'APPROVED')
        )
        SELECT 
          *,
          ROUND((outstanding_principal_paise::numeric / NULLIF(current_appraised_value_paise, 0)) * 100, 2) as current_ltv_pct,
          CASE 
            WHEN principal_paise <= 20000000 THEN 80.0
            WHEN principal_paise <= 50000000 THEN 75.0
            ELSE 70.0
          END as slab_max_ltv_pct
        FROM current_appraisals
        WHERE ROUND((outstanding_principal_paise::numeric / NULLIF(current_appraised_value_paise, 0)) * 100, 2) > 
              CASE 
                WHEN principal_paise <= 20000000 THEN 80.0
                WHEN principal_paise <= 50000000 THEN 75.0
                ELSE 70.0
              END;
      `),
    ]);

    return res.status(200).json({ history, breaches });
  } catch (err) {
    console.error('Rate history error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to fetch rate history.' });
  }
}