import type { CreateSessionResponse } from './types'

const SESSION_KEY = 'sessionData'
const DEVICES_KEY = 'devicePrefs'

export interface DevicePrefs {
  camera: boolean
  microphone: boolean
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

export const loadSession = () => read<CreateSessionResponse>(SESSION_KEY)
export const saveSession = (data: CreateSessionResponse) => write(SESSION_KEY, data)
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export const loadDevicePrefs = (): DevicePrefs => read<DevicePrefs>(DEVICES_KEY) ?? { camera: true, microphone: true }
export const saveDevicePrefs = (prefs: DevicePrefs) => write(DEVICES_KEY, prefs)
