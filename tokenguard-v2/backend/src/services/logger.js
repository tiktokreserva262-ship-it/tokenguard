import { query } from './db.js';

/**
 * Writes an access log entry.
 * Runs fire-and-forget — never blocks the request.
 */
export function logAccess({ projectId, sessionId, ip, status, reason, metadata = {} }) {
  query(
    `INSERT INTO access_logs (project_id, session_id, ip, status, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [projectId ?? null, sessionId ?? null, ip ?? null, status, reason ?? null, JSON.stringify(metadata)]
  ).catch(err => console.error('[Logger] failed to write log:', err.message));
}
