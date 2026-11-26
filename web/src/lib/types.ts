export type SessionType = 'interview' | 'presentation' | 'simulation'
export type Level = 'junior' | 'mid' | 'senior'

export interface SessionOptions {
  role?: string
  level?: Level
  topic?: string
  duration?: number
  scenario?: string
}

export interface SessionConfig {
  sessionType: SessionType
  options: SessionOptions
}

export interface CreateSessionResponse {
  roomName: string
  token: string
  sessionId: string
  livekitUrl: string
  sessionConfig: SessionConfig
}

export interface Improvement {
  title: string
  howToPractice: string
}

export interface ReportData {
  sessionId: string
  sessionType: SessionType
  summary: string[]
  strengths: string[]
  improvements: Improvement[]
  rewriteSuggestion?: { question: string; betterAnswer: string }
}

export interface ReportResponse {
  id: number
  sessionId: string
  report: ReportData
  createdAt: string | null
}

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  interview: 'ראיון עבודה',
  presentation: 'פרזנטציה',
  simulation: 'סימולציית לחץ',
}
