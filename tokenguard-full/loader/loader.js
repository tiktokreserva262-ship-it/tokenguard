/**
 * TokenGuard Loader v1.0
 * ─────────────────────────────────────────────
 * Arquivo público. Não contém segredos.
 * Coloque no <head> do seu index.html:
 *
 *   <script
 *     src="https://cdn.tokenguard.io/loader.js"
 *     data-project="proj_SEU_ID"
 *     data-api="https://api.tokenguard.io"
 *   ></script>
 */
(function () {
  'use strict';

  const script     = document.currentScript;
  const PROJECT_ID = script.dataset.project;
  const API_URL    = (script.dataset.api || 'https://api.tokenguard.io').replace(/\/$/, '');
  const SESSION_KEY = `tg_sid_${PROJECT_ID}`;

  if (!PROJECT_ID) {
    return renderBlock('missing_project_id');
  }

  /* ── SESSION ID ────────────────────────────────────────────── */
  function getSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  /* ── STEP 1: pedir token ao backend ───────────────────────── */
  async function requestToken() {
    const res = await fetch(`${API_URL}/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: PROJECT_ID, origin: location.origin }),
    });
    if (!res.ok) throw new Error('generate_token_failed');
    const { token } = await res.json();
    return token;
  }

  /* ── STEP 2: validar token ─────────────────────────────────── */
  async function validate(token) {
    const res = await fetch(`${API_URL}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TG-Session': getSessionId(),
      },
      body: JSON.stringify({ token, origin: location.origin }),
    });
    return res.json();
  }

  /* ── STEP 3: download + decrypt bundle ─────────────────────── */
  async function loadBundle(bundleUrl, keyBase64) {
    const res    = await fetch(bundleUrl);
    const buffer = await res.arrayBuffer();

    const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'raw', rawKey, 'AES-GCM', false, ['decrypt']
    );

    const iv        = new Uint8Array(buffer, 0, 12);
    const encrypted = new Uint8Array(buffer, 12);
    const plain     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);

    const src    = new TextDecoder().decode(plain);
    const s      = document.createElement('script');
    s.type       = 'module';
    s.textContent = src;
    document.getElementById('tg-root')?.appendChild(s) ?? document.body.appendChild(s);
  }

  /* ── RENDER BLOCK ──────────────────────────────────────────── */
  function renderBlock(reason) {
    const root = document.getElementById('tg-root') ?? document.body;
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100vh;background:#080c14;color:#ff4060;font-family:monospace;gap:16px">
        <div style="font-size:56px">🔒</div>
        <div style="font-size:18px;font-weight:700">Acesso Bloqueado</div>
        <div style="font-size:12px;color:#4a6080;background:#111927;padding:8px 16px;
                    border-radius:6px;border:1px solid #1e3050">
          TokenGuard: ${reason}
        </div>
      </div>`;
  }

  /* ── MAIN ──────────────────────────────────────────────────── */
  async function init() {
    try {
      const token = await requestToken();
      const auth  = await validate(token);

      if (!auth.authorized) {
        renderBlock(auth.reason ?? 'unauthorized');
        return;
      }

      if (auth.bundleUrl) {
        await loadBundle(auth.bundleUrl, auth.key);
      }
      // Se não há bundle (modo só-validação), o app já está no HTML e apenas continua
    } catch (e) {
      console.error('[TokenGuard]', e);
      renderBlock('network_error');
    }
  }

  init();
})();
