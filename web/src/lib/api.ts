import type { CreateSessionResponse, ReportResponse, SessionConfig } from './types'

/**
 * Empty base = same origin. In dev, Vite proxies /api to the backend (vite.config.mts),
 * so no CORS setup is needed locally. In production set VITE_API_URL.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'לא ניתן להתחבר לשרת. ודא שה-backend רץ.')
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json() as Promise<T>
}

export function createSession(sessionConfig: SessionConfig): Promise<CreateSessionResponse> {
  return request('/api/sessions', { method: 'POST', body: JSON.stringify({ sessionConfig }) })
}

export function getReport(sessionId: string, signal?: AbortSignal): Promise<ReportResponse> {
  return request(`/api/sessions/${encodeURIComponent(sessionId)}/report`, { signal })
}
