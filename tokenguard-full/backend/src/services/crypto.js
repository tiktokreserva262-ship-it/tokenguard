import { createHmac, randomBytes } from 'crypto';

const MASTER = process.env.MASTER_SECRET;
if (!MASTER) throw new Error('MASTER_SECRET não definido no .env');

/**
 * Deriva uma chave AES-256 efêmera para um bundle específico.
 * Cada (projectId + jti) gera uma chave diferente.
 * A chave não é armazenada — é derivada on-the-fly na validação.
 */
export function deriveBundleKey(projectId, jti) {
  const key = createHmac('sha256', MASTER)
    .update(`${projectId}:${jti}:${Math.floor(Date.now() / 3600000)}`) // rotaciona por hora
    .digest('base64');
  return key; // 44 chars base64 = 32 bytes
}

/**
 * Criptografa um bundle JS com AES-GCM 256.
 * Retorna Buffer: [12 bytes IV] + [encrypted data]
 */
export async function encryptBundle(plaintext, keyBase64) {
  const { webcrypto } = await import('crypto');
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

export function maskIp(ip) {
  if (!ip) return '0.0.0.*';
  return ip.replace(/(\d+)$/, '*');
}
