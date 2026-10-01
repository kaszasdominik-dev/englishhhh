const configuredBackend = (process.env.REACT_APP_BACKEND_URL || '').trim().replace(/\/$/, '');
const isBrowser = typeof window !== 'undefined';
const isLocalHost = isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Local development works without a frontend .env; production defaults to same-origin
// and can still be overridden with REACT_APP_BACKEND_URL for split deployments.
export const BACKEND_URL = configuredBackend || (isLocalHost ? 'http://localhost:8000' : (isBrowser ? window.location.origin : ''));
export const API = `${BACKEND_URL}/api`;

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const ct = res.headers.get('content-type') || '';
  const raw = await res.text();
  let data = raw;
  try {
    if (ct.includes('json') || raw.trim().startsWith('{') || raw.trim().startsWith('[')) data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' ? (data?.error?.message || data?.error || data?.message) : raw;
    const err = new Error(String(msg || `HTTP ${res.status}`));
    err.code = typeof data === 'object' ? data?.code : undefined;
    err.status = res.status;
    throw err;
  }
  return data;
}
