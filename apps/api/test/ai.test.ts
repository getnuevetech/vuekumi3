import assert from 'node:assert/strict'
import { test } from 'node:test'
import { heuristicSuggest } from '../src/lib/ai.js'

test('heuristic suggestion never auto-applies and flags people categories', () => {
  const people = heuristicSuggest({ title: 'market portrait', category: 'People', country: 'Nigeria' })
  assert.equal(people.provider, 'dev')
  assert.equal(people.hasRecognizablePeople, true)
  assert.match(people.notes ?? '', /applied automatically/i)
  assert.ok(people.tags.includes('nigeria') || people.tags.includes('market'))
})

test('heuristic falls back to filename and landscape', () => {
  const s = heuristicSuggest({ filename: 'dusk-baobab.jpg' })
  assert.equal(s.category, 'Landscape')
  assert.match(s.title ?? '', /Dusk Baobab/i)
  assert.equal(s.hasRecognizablePeople, false)
})
