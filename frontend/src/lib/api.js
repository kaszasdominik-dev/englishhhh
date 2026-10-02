const configuredBackend = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/$/, '');
const isBrowser = typeof window !== 'undefined';
const isLocalHost = isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Local development works without a frontend .env; production defaults to same-origin.
// Split frontend/backend deployments can override this with REACT_APP_BACKEND_URL.
export const BACKEND_URL = configuredBackend || (isLocalHost ? 'http://localhost:8000' : (isBrowser ? window.location.origin : ''));
export const API = `${BACKEND_URL}/api`;

const CLIENT_ID_KEY = 'livo_client_id';

export function getClientId() {
  if (!isBrowser) return 'server-render';
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (id && /^[a-zA-Z0-9_-]{8,80}$/.test(id)) return id;
    const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    id = `anon_${random}`.slice(0, 80);
    window.localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    // Storage may be blocked in privacy modes. This still avoids a shared hard-coded demo id
    // within the current page session.
    if (!window.__livoEphemeralClientId) {
      window.__livoEphemeralClientId = `anon_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 80);
    }
    return window.__livoEphemeralClientId;
  }
}

export function clientHeaders(extra = {}) {
  return {
    Accept: 'application/json',
    'X-Livo-Client': getClientId(),
    ...extra,
  };
}

function friendlyNetworkError(err) {
  if (err?.name === 'AbortError') return new Error('A szerver nem válaszolt időben. Próbáld újra.');
  if (!isBrowser || navigator.onLine !== false) return new Error('Nem sikerült elérni a LIVO szerverét. Ellenőrizd, hogy fut-e a backend és van-e internetkapcsolat.');
  return new Error('Nincs internetkapcsolat. Csatlakozz a hálózathoz, majd próbáld újra.');
}

export async function api(path, options = {}) {
  const externalSignal = options.signal;
  const controller = externalSignal ? null : new AbortController();
  const timeoutMs = Number(options.timeoutMs || 20000);
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(1000, timeoutMs)) : null;

  const headers = clientHeaders({
    ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  });

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      credentials: 'include',
      ...options,
      headers,
      signal: externalSignal || controller.signal,
    });
  } catch (err) {
    throw friendlyNetworkError(err);
  } finally {
    if (timer) clearTimeout(timer);
  }

  const ct = res.headers.get('content-type') || '';
  const raw = await res.text();
  let data = raw;
  try {
    if (ct.includes('json') || raw.trim().startsWith('{') || raw.trim().startsWith('[')) data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw;
  }

  if (!res.ok) {
    const msg = typeof data === 'object' && data
      ? (data?.error?.message || data?.error || data?.detail || data?.message)
      : raw;
    const err = new Error(String(msg || `HTTP ${res.status}`).slice(0, 500));
    err.code = typeof data === 'object' && data ? data?.code : undefined;
    err.status = res.status;
    throw err;
  }
  return data;
}
