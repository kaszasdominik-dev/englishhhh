const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const ct = res.headers.get('content-type') || '';
  const raw = await res.text();
  let data = raw;
  try { if (ct.includes('json') || raw.trim().startsWith('{') || raw.trim().startsWith('[')) data = JSON.parse(raw); } catch { /* keep raw */ }
  if (!res.ok) {
    const msg = typeof data === 'object' ? (data?.error?.message || data?.error || data?.message) : raw;
    const err = new Error(String(msg || `HTTP ${res.status}`));
    err.code = typeof data === 'object' ? data?.code : undefined;
    err.status = res.status;
    throw err;
  }
  return data;
}
