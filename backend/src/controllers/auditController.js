import { query } from '../db/index.js';

/**
 * GET /api/audit
 * Immutable Audit Log Viewer (Branch Manager and Admin only)
 */
export async function getAuditLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [{ rows: countRows }, { rows: logs }] = await Promise.all([
      query('SELECT COUNT(*) FROM audit_logs'),
      query(`
        SELECT al.*, u.full_name as performed_by_name, u.role as user_role
        FROM audit_logs al
        JOIN users u ON al.performed_by_user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
    ]);

    const totalCount = parseInt(countRows[0].count, 10);

    return res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve audit trail.' });
  }
}