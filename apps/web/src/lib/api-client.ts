const DEFAULT_TIMEOUT_MS = 20_000;

export async function api<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (typeof window !== "undefined") {
    const devId = localStorage.getItem("mmabon_dev_user_id");
    if (devId) headers.set("x-dev-user-id", devId);
  }

  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _drop, signal: userSignal, ...rest } = init ?? {};
  void _drop;

  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  let signal: AbortSignal | undefined = userSignal ?? timeoutSignal;
  if (userSignal && timeoutSignal && typeof AbortSignal.any === "function") {
    signal = AbortSignal.any([userSignal, timeoutSignal]);
  }

  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, signal });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      throw new Error(
        "Request timed out — the desk could not reach the database in time. Try again.",
      );
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
