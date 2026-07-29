interface ApiOptions {
  method?: string;
  body?: unknown;
}

export async function api<T = unknown>(path: string, { method = 'GET', body }: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.status === 204 ? (null as T) : res.json();
}
