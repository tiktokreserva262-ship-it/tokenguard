import { query } from './db.js';

export async function logAccess({ projectId, sessionId, ip, status, reason }) {
  try {
    await query(
      `INSERT INTO access_logs (project_id, session_id, ip, status, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [projectId ?? null, sessionId ?? null, ip ?? null, status, reason ?? null]
    );
  } catch (e) {
    console.error('[logger]', e.message);
  }
}
