/**
 * TokenGuard Loader v2.0
 * ──────────────────────────────────────────────────────────────────
 * Public file — contains no secrets.
 *
 * Drop this in your <head> to instantly protect your frontend:
 *
 *   <script
 *     src="https://cdn.tokenguard.io/loader.js"
 *     data-project="proj_yourprojectid"
 *     data-api="https://api.tokenguard.io"
 *   ></script>
 *
 * Optional attributes:
 *   data-mode="runtime"              (default: runtime)
 *   data-block-title="..."           Custom block overlay title
 *   data-block-bg="#080c14"          Custom overlay background
 * ──────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  const SDK_VERSION = '2.0.0';
  const script = document.currentScript;

  const PROJECT_ID  = script.dataset.project;
  const API_URL     = (script.dataset.api || 'https://api.tokenguard.io').replace(/\/$/, '');
  const MODE        = script.dataset.mode || 'runtime';
  const BLOCK_TITLE = script.dataset.blockTitle;
  const BLOCK_BG    = script.dataset.blockBg;
  const SESSION_KEY = `_tg_sid_${PROJECT_ID}`;

  if (!PROJECT_ID) {
    return renderBlock('missing_project_id');
  }

  // ── Session ID ─────────────────────────────────────────────────
  function getOrCreateSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `clt_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  // ── HTTP ───────────────────────────────────────────────────────
  async function post(path, body, headers) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TG-SDK-Version': SDK_VERSION,
        ...headers,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.message || 'Request failed'), { code: err.error });
    }
    return res.json();
  }

  // ── Block overlay ──────────────────────────────────────────────
  function renderBlock(reason) {
    const root = document.getElementById('tg-root') ?? document.body;
    root.style.cssText = '';
    root.innerHTML = `
      <div id="_tg_block" style="
        position:fixed;inset:0;z-index:2147483647;
        background:${BLOCK_BG || '#080c14'};
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        font-family:monospace;gap:12px;
      ">
        <div style="font-size:48px">🔒</div>
        <div style="font-size:16px;font-weight:700;color:#e8f0ff">
          ${BLOCK_TITLE || 'Access Protected'}
        </div>
        <div style="font-size:11px;color:#4a6080;background:rgba(255,255,255,0.04);
                    padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.08)">
          tokenguard: ${reason}
        </div>
      </div>`;
  }

  // ── Bundle loader ──────────────────────────────────────────────
  async function loadEncryptedBundle(bundleUrl, keyBase64) {
    const res    = await fetch(bundleUrl);
    const buffer = await res.arrayBuffer();
    const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    const key    = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const iv     = new Uint8Array(buffer, 0, 12);
    const enc    = new Uint8Array(buffer, 12);
    const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc);
    const src    = new TextDecoder().decode(plain);
    const s      = document.createElement('script');
    s.type       = 'module';
    s.textContent = src;
    (document.getElementById('tg-root') ?? document.body).appendChild(s);
  }

  // ── Heartbeat ──────────────────────────────────────────────────
  let _token = null;
  let _heartbeatTimer = null;

  function startHeartbeat(interval, sid) {
    _heartbeatTimer = setInterval(async () => {
      if (!_token) return;
      try {
        const res = await post('/session-heartbeat', { token: _token }, { 'X-TG-Session': sid });
        if (res.alive && res.token) {
          _token = res.token; // rolling refresh
        } else {
          clearInterval(_heartbeatTimer);
          renderBlock(res.reason ?? 'session_lost');
        }
      } catch {
        // Silently retry — persistent failures will be caught when token expires
      }
    }, interval * 1000);
  }

  // ── Main init ──────────────────────────────────────────────────
  async function init() {
    const sessionId = getOrCreateSessionId();
    try {
      // 1. Generate token — send fingerprint for clone detection
      const gen = await post('/generate-token', {
        projectId: PROJECT_ID,
        origin:    location.origin,
        host:      location.hostname,
        href:      location.href,
        userAgent: navigator.userAgent,
      });
      _token = gen.token;

      // 2. Validate token
      const auth = await post(
        '/validate-token',
        { token: gen.token, origin: location.origin },
        { 'X-TG-Session': sessionId }
      );

      if (!auth.authorized) {
        renderBlock(auth.reason ?? 'unauthorized');
        return;
      }

      // 3. Optionally load encrypted bundle
      if (auth.bundleUrl && auth.key) {
        await loadEncryptedBundle(auth.bundleUrl, auth.key);
      }

      // 4. Start heartbeat for continuous verification
      const beatInterval = auth.heartbeatInterval ?? 30;
      startHeartbeat(beatInterval, sessionId);

    } catch (err) {
      console.error('[TokenGuard Loader]', err);
      renderBlock(err.code ?? 'init_error');
    }
  }

  init();
})();
