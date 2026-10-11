export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | undefined;

export async function upload<T>(path: string, form: FormData, method: "POST" = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, body: form, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try {
      const d = (await res.json())?.detail;
      if (typeof d === "string") msg = d;
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

/** Same-origin JSON call. The session is an HttpOnly cookie, so no token handling here. */
export async function api<T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET", body?: Body): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      const d = j?.detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d)) msg = d.map((x: { msg?: string }) => x.msg).filter(Boolean).join(". ") || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}
