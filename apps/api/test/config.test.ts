import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertProductionSecrets, config } from '../src/config.js'

test('production secret check is a no-op outside production', () => {
  assert.doesNotThrow(() => assertProductionSecrets())
})

test('production requires a strong SETTINGS_ENCRYPTION_KEY distinct from JWT/COOKIE secrets', () => {
  const originalNodeEnv = config.nodeEnv
  const originalJwt = config.jwtSecret
  const originalCookie = config.cookieSecret
  const originalKey = process.env.SETTINGS_ENCRYPTION_KEY

  try {
    config.nodeEnv = 'production'
    config.jwtSecret = 'a-strong-unique-jwt-secret-value-0123456789'
    config.cookieSecret = 'a-strong-unique-cookie-secret-value-0123456789'

    delete process.env.SETTINGS_ENCRYPTION_KEY
    assert.throws(() => assertProductionSecrets(), /SETTINGS_ENCRYPTION_KEY/)

    process.env.SETTINGS_ENCRYPTION_KEY = config.jwtSecret
    assert.throws(() => assertProductionSecrets(), /distinct/)

    process.env.SETTINGS_ENCRYPTION_KEY = 'a-strong-unique-settings-key-0123456789'
    assert.doesNotThrow(() => assertProductionSecrets())
  } finally {
    config.nodeEnv = originalNodeEnv
    config.jwtSecret = originalJwt
    config.cookieSecret = originalCookie
    if (originalKey === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY
    else process.env.SETTINGS_ENCRYPTION_KEY = originalKey
  }
})
