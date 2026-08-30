const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.pinRequired = !!body?.pin_required;
  }
}

async function request(method, path, body, pin) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (pin) headers['x-family-pin'] = pin;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, pin) => request('POST', path, body, pin),
  put: (path, body, pin) => request('PUT', path, body, pin),
  del: (path, pin) => request('DELETE', path, undefined, pin),
};
