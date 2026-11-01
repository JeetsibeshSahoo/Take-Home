import { query } from '../db/index.js';

/**
 * Append-only Audit Trail Service
 * Every create, approval, payment, and closure writes who did it, when, and what changed.
 * As per the brief: Staff cannot edit or delete audit entries.
 */
export async function logAudit({
  entityName,
  entityId,
  action,
  performedByUserId,
  ipAddress = null,
  details = {},
  client = null, // Optional transaction client
}) {
  const sql = `
    INSERT INTO audit_logs (entity_name, entity_id, action, performed_by_user_id, ip_address, details)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, created_at;
  `;
  const params = [
    entityName,
    String(entityId),
    action,
    performedByUserId,
    ipAddress,
    JSON.stringify(details),
  ];

  if (client) {
    return client.query(sql, params);
  }
  return query(sql, params);
}