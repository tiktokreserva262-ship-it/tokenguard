/**
 * TokenGuard SDK v2.0
 * Runtime Protection for Frontend Applications
 *
 * Usage (ESM):
 *   import TokenGuard from 'tokenguard-sdk';
 *   await TokenGuard.init({ projectId: 'proj_xxx', api: 'https://api.tokenguard.io' });
 *
 * Usage (CDN / UMD):
 *   <script src="https://cdn.tokenguard.io/sdk.js"></script>
 *   await window.TokenGuard.init({ projectId: 'proj_xxx' });
 *
 * Usage (HTML data-attributes loader):
 *   <script src="https://cdn.tokenguard.io/loader.js"
 *           data-project="proj_xxx"
 *           data-api="https://api.tokenguard.io"></script>
 */

const SDK_VERSION = '2.0.0';
const DEFAULT_API = 'https://api.tokenguard.io';

// ── Internal state ────────────────────────────────────────────────
let _state = {
  initialized: false,
  authorized: false,
  projectId: null,
  sessionId: null,
  token: null,
  heartbeatTimer: null,
  config: null,
  listeners: {},
};

// ── Event system ──────────────────────────────────────────────────
function emit(event, data) {
  const handlers = _state.listeners[event] ?? [];
  handlers.forEach(fn => { try { fn(data); } catch {} });
}

// ── Session ID management ─────────────────────────────────────────
function getOrCreateSessionId(projectId) {
  const key = `_tg_sid_${projectId}`;
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = `clt_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

// ── HTTP helpers ──────────────────────────────────────────────────
async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TG-SDK-Version': SDK_VERSION,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message ?? 'Request failed'), { code: data.error, status: res.status });
  return data;
}

// ── Block overlay ─────────────────────────────────────────────────
function renderBlockOverlay(reason, config = {}) {
  // Remove existing overlay
  document.getElementById('_tg_overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_tg_overlay';
  overlay.setAttribute('data-tg-reason', reason);

  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    background: config.blockBackground ?? '#080c14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    gap: '12px',
  });

  overlay.innerHTML = `
    <div style="font-size:48px">🔒</div>
    <div style="font-size:16px;font-weight:700;color:#e8f0ff">
      ${config.blockTitle ?? 'Access Protected'}
    </div>
    <div style="font-size:11px;color:#4a6080;background:rgba(255,255,255,0.04);
                padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.08)">
      tokenguard: ${reason}
    </div>
  `;

  document.body.appendChild(overlay);
}

function removeBlockOverlay() {
  document.getElementById('_tg_overlay')?.remove();
}

// ── Bundle loader (AES-GCM decryption) ────────────────────────────
async function loadEncryptedBundle(bundleUrl, keyBase64) {
  const res = await fetch(bundleUrl);
  if (!res.ok) throw new Error('bundle_fetch_failed');

  const buffer = await res.arrayBuffer();
  const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'raw', rawKey, 'AES-GCM', false, ['decrypt']
  );

  const iv        = new Uint8Array(buffer, 0, 12);
  const encrypted = new Uint8Array(buffer, 12);
  const plain     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);

  const src = new TextDecoder().decode(plain);
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = src;
  (document.getElementById('tg-root') ?? document.body).appendChild(script);
}

// ── Heartbeat ─────────────────────────────────────────────────────
function startHeartbeat(apiBase, interval) {
  stopHeartbeat();

  const beat = async () => {
    if (!_state.token || !_state.sessionId) return;
    try {
      const res = await post(
        `${apiBase}/session-heartbeat`,
        { token: _state.token },
        { 'X-TG-Session': _state.sessionId }
      );

      if (res.alive && res.token) {
        // Rolling token refresh — update internal state
        _state.token = res.token;
        emit('token:refresh', { expiresIn: res.expiresIn });
      } else {
        handleSessionLost('heartbeat_failed');
      }
    } catch (err) {
      const code = err.code ?? 'network_error';
      if (code === 'token_revoked' || code === 'project_inactive' || code === 'session_not_found') {
        handleSessionLost(code);
      }
      // Transient network errors are tolerated for up to 3 missed beats
      emit('heartbeat:error', { error: err });
    }
  };

  // First beat immediately, then on interval
  beat();
  _state.heartbeatTimer = setInterval(beat, interval * 1000);
}

function stopHeartbeat() {
  if (_state.heartbeatTimer) {
    clearInterval(_state.heartbeatTimer);
    _state.heartbeatTimer = null;
  }
}

function handleSessionLost(reason) {
  _state.authorized = false;
  stopHeartbeat();
  renderBlockOverlay(reason, _state.config ?? {});
  emit('session:lost', { reason });
}

// ── Main SDK ──────────────────────────────────────────────────────
const TokenGuard = {
  version: SDK_VERSION,

  /**
   * Initialize TokenGuard protection.
   *
   * @param {object} options
   * @param {string} options.projectId  - Your project ID from the dashboard
   * @param {string} [options.api]      - API base URL (default: https://api.tokenguard.io)
   * @param {string} [options.mode]     - 'runtime' (default) | 'passive'
   * @param {boolean} [options.strictDomain] - Enforce domain matching (default: true)
   * @param {string} [options.blockTitle]    - Custom block overlay title
   * @param {string} [options.blockBackground] - Custom block overlay background
   */
  async init(options = {}) {
    if (_state.initialized) {
      console.warn('[TokenGuard] Already initialized. Call destroy() first.');
      return;
    }

    const config = {
      projectId:  options.projectId,
      api:        (options.api ?? DEFAULT_API).replace(/\/$/, ''),
      mode:       options.mode ?? 'runtime',
      strictDomain: options.strictDomain !== false,
      blockTitle:   options.blockTitle,
      blockBackground: options.blockBackground,
    };

    if (!config.projectId) {
      console.error('[TokenGuard] projectId is required');
      renderBlockOverlay('missing_project_id', config);
      return;
    }

    _state.config = config;
    _state.initialized = true;

    const sessionId = getOrCreateSessionId(config.projectId);
    _state.sessionId = sessionId;

    try {
      emit('init:start', { projectId: config.projectId });

      // Step 1: Request short-lived token from backend — include fingerprint for clone detection
      const genRes = await post(
        `${config.api}/generate-token`,
        {
          projectId: config.projectId,
          origin:    location.origin,
          host:      location.hostname,
          href:      location.href,
          userAgent: navigator.userAgent,
        },
      );

      _state.token = genRes.token;

      // Step 2: Validate token + authorize
      const authRes = await post(
        `${config.api}/validate-token`,
        { token: genRes.token, origin: location.origin },
        { 'X-TG-Session': sessionId }
      );

      if (!authRes.authorized) {
        renderBlockOverlay(authRes.reason ?? 'unauthorized', config);
        emit('auth:blocked', { reason: authRes.reason });
        return;
      }

      _state.authorized = true;
      removeBlockOverlay();

      // Step 3: Load encrypted bundle (optional)
      if (authRes.bundleUrl && authRes.key) {
        await loadEncryptedBundle(authRes.bundleUrl, authRes.key);
      }

      // Step 4: Start heartbeat
      const beatInterval = authRes.heartbeatInterval ?? 30;
      startHeartbeat(config.api, beatInterval);

      emit('auth:granted', { projectId: config.projectId, expiresIn: authRes.expiresIn });

    } catch (err) {
      console.error('[TokenGuard]', err);
      renderBlockOverlay(err.code ?? 'init_error', config);
      emit('init:error', { error: err });
    }
  },

  /**
   * Check current authorization state.
   */
  isAuthorized() {
    return _state.authorized;
  },

  /**
   * Get current session ID.
   */
  getSessionId() {
    return _state.sessionId;
  },

  /**
   * Subscribe to SDK events.
   * Events: 'auth:granted', 'auth:blocked', 'session:lost',
   *         'heartbeat:error', 'token:refresh', 'init:start', 'init:error'
   */
  on(event, handler) {
    if (!_state.listeners[event]) _state.listeners[event] = [];
    _state.listeners[event].push(handler);
    return () => TokenGuard.off(event, handler); // returns unsubscribe fn
  },

  off(event, handler) {
    if (!_state.listeners[event]) return;
    _state.listeners[event] = _state.listeners[event].filter(h => h !== handler);
  },

  /**
   * Tear down the SDK. Stops heartbeat, removes overlays.
   */
  destroy() {
    stopHeartbeat();
    removeBlockOverlay();
    _state = {
      initialized: false, authorized: false,
      projectId: null, sessionId: null, token: null,
      heartbeatTimer: null, config: null, listeners: {},
    };
  },
};

// UMD / global export for non-module environments
if (typeof window !== 'undefined') {
  window.TokenGuard = TokenGuard;
}

export default TokenGuard;
