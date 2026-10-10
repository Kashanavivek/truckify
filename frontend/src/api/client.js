/**
 * Tiny fetch wrapper for the Truckify REST API.
 * In dev, Vite proxies /api to the Express server (see vite.config.js).
 * Set VITE_API_URL for a deployed backend.
 */
let rawBase = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
if (rawBase.startsWith('http') && !rawBase.endsWith('/api')) {
  rawBase += '/api';
}
const BASE = rawBase;
const TOKEN_KEY = 'truckify_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('Cannot reach the Truckify API. Is the backend running on port 4000?', 0);
  }

  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || (json && json.success === false)) {
    const msg = (json && json.error) || `Request failed (${res.status})`;
    const err = new ApiError(msg, res.status, json && json.details);
    if (res.status === 401) tokenStore.clear();
    throw err;
  }
  return json;
}

/** Build a query string, dropping empty values. */
export function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== 'all');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
}

export const money = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));

export const prettyDate = (d) => {
  if (!d) return '-';
  const date = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const shortDateTime = (d) => (d ? new Date(String(d).replace(' ', 'T') + 'Z').toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
