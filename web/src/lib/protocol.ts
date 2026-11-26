/**
 * Data-channel protocol between the web client and the coach agent.
 * Must match the constants in agent/agent.py.
 */
export const DATA_TOPIC = 'coach'

export type CoachAction = 'NEXT' | 'DONE'

export type ClientMessage = { type: 'COACH_ACTION'; action: CoachAction }

export type AgentMessage =
  | { type: 'REPORT_READY'; sessionId: string }
  | { type: 'REPORT_FAILED'; sessionId: string }

export function encodeMessage(message: ClientMessage): ReturnType<TextEncoder['encode']> {
  return new TextEncoder().encode(JSON.stringify(message))
}

export function decodeAgentMessage(payload: Uint8Array): AgentMessage | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload))
    if (
      parsed &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      (parsed.type === 'REPORT_READY' || parsed.type === 'REPORT_FAILED') &&
      'sessionId' in parsed &&
      typeof parsed.sessionId === 'string'
    ) {
      return parsed as AgentMessage
    }
  } catch {
    /* ignore malformed packets */
  }
  return null
}
