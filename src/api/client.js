const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Error carrying the server-supplied reason so callers can surface it inline. */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function parseError(response) {
  try {
    const body = await response.json();
    const message = body?.error ?? body?.detail;
    return new ApiError(
      typeof message === 'string' ? message : `Request failed (${response.status})`,
      response.status,
      body
    );
  } catch {
    return new ApiError(`Request failed (${response.status})`, response.status);
  }
}

export async function postJson(path, payload, { signal } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) throw await parseError(response);
  return response.json();
}

export async function postFile(path, file, field = 'file') {
  const body = new FormData();
  body.append(field, file);

  const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', body });

  if (!response.ok) throw await parseError(response);
  return response.json();
}
