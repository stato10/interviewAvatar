import { describe, expect, it } from 'vitest'
import { decodeAgentMessage, encodeMessage } from './protocol'

const enc = (v: unknown) => new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v))

describe('protocol', () => {
  it('encodes client actions as JSON', () => {
    const bytes = encodeMessage({ type: 'COACH_ACTION', action: 'DONE' })
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ type: 'COACH_ACTION', action: 'DONE' })
  })

  it('decodes agent messages', () => {
    expect(decodeAgentMessage(enc({ type: 'REPORT_READY', sessionId: 's1' }))).toEqual({
      type: 'REPORT_READY',
      sessionId: 's1',
    })
  })

  it('rejects unknown or malformed packets', () => {
    expect(decodeAgentMessage(enc('not json'))).toBeNull()
    expect(decodeAgentMessage(enc({ type: 'OTHER', sessionId: 's1' }))).toBeNull()
    expect(decodeAgentMessage(enc({ type: 'REPORT_READY' }))).toBeNull()
  })
})
