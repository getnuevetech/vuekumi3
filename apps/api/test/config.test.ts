import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertProductionSecrets } from '../src/config.js'

test('production secret check is a no-op outside production', () => {
  assert.doesNotThrow(() => assertProductionSecrets())
})
