import { describe, expect, it } from 'vitest'
import {
  decodeVapidKey,
  isIosLike,
  isIosWithoutPwa,
  isStandalonePwa,
  pushIsConfigured,
} from './push.ts'

describe('config VAPID', () => {
  it('sin clave no está configurado', () => {
    expect(pushIsConfigured({})).toBe(false)
    expect(pushIsConfigured({ VITE_VAPID_PUBLIC_KEY: '' })).toBe(false)
    expect(pushIsConfigured({ VITE_VAPID_PUBLIC_KEY: 'BKtest' })).toBe(true)
  })
})

describe('decodeVapidKey', () => {
  it('decodifica base64 URL-safe a bytes', () => {
    // "hi" en base64url
    const bytes = decodeVapidKey('aGk')
    expect(Array.from(bytes)).toEqual([104, 105])
  })
})

describe('detección iOS / PWA', () => {
  it('reconoce iPhone y iPadOS táctil', () => {
    expect(isIosLike('Mozilla/iPhone', 'iPhone', 5)).toBe(true)
    expect(isIosLike('Mozilla/Macintosh', 'MacIntel', 5)).toBe(true)
    expect(isIosLike('Mozilla/Macintosh', 'MacIntel', 0)).toBe(false)
    expect(isIosLike('Mozilla/Chrome', 'Linux x86_64', 0)).toBe(false)
  })

  it('standalone cuenta como PWA instalada', () => {
    expect(isStandalonePwa(true, false)).toBe(true)
    expect(isStandalonePwa(false, true)).toBe(true)
    expect(isStandalonePwa(false, false)).toBe(false)
  })

  it('iOS sin PWA instalada', () => {
    expect(
      isIosWithoutPwa({
        userAgent: 'iPhone',
        platform: 'iPhone',
        maxTouchPoints: 5,
        displayModeStandalone: false,
        legacyStandalone: false,
      }),
    ).toBe(true)
    expect(
      isIosWithoutPwa({
        userAgent: 'iPhone',
        platform: 'iPhone',
        maxTouchPoints: 5,
        displayModeStandalone: true,
        legacyStandalone: false,
      }),
    ).toBe(false)
    expect(
      isIosWithoutPwa({
        userAgent: 'Mozilla/Chrome',
        platform: 'Linux',
        maxTouchPoints: 0,
        displayModeStandalone: false,
        legacyStandalone: false,
      }),
    ).toBe(false)
  })
})
