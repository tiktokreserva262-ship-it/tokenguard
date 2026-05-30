import { createHmac, randomBytes } from 'crypto';
import { webcrypto } from 'crypto';

const MASTER = process.env.MASTER_SECRET;
if (!MASTER) throw new Error('MASTER_SECRET is not defined in environment');

/**
 * Derives an ephemeral AES-256 key for a specific (project, session) pair.
 * Rotates every hour to limit replay exposure.
 * Never stored — derived on-the-fly on each valid request.
 */
export function deriveBundleKey(projectId, jti) {
  const hourSlot = Math.floor(Date.now() / 3_600_000);
  return createHmac('sha256', MASTER)
    .update(`bundle:${projectId}:${jti}:${hourSlot}`)
    .digest('base64'); // 44 chars = 32 bytes
}

/**
 * Encrypts a JS bundle with AES-GCM-256.
 * Output format: [12-byte IV][ciphertext]
 */
export async function encryptBundle(plaintext, keyBase64) {
  const rawKey = Buffer.from(keyBase64, 'base64');
  const cryptoKey = await webcrypto.subtle.importKey(
    'raw', rawKey, 'AES-GCM', false, ['encrypt']
  );
  const iv = randomBytes(12);
  const enc = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    Buffer.from(plaintext)
  );
  return Buffer.concat([iv, Buffer.from(enc)]);
}

/**
 * Masks the last octet of an IP for GDPR-safe logging.
 */
export function maskIp(ip = '') {
  if (!ip) return '0.0.0.*';
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    parts[parts.length - 1] = '****';
    return parts.join(':');
  }
  return ip.replace(/(\d+)$/, '*');
}

/**
 * Generates a cryptographically secure project ID.
 */
export function generateProjectId() {
  const rand = randomBytes(8).toString('hex');
  return `proj_${rand}`;
}
