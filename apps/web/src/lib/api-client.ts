export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (typeof window !== "undefined") {
    const devId = localStorage.getItem("mmabon_dev_user_id");
    if (devId) headers.set("x-dev-user-id", devId);
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
