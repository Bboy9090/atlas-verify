import test from 'node:test'
import assert from 'node:assert/strict'
import { createSearchSession } from '../lib/workspace-search-session.ts'

test('new request invalidates old response', () => {
  const session = createSearchSession()
  const first = session.begin()
  const second = session.begin()
  assert.equal(first.signal.aborted, true)
  assert.equal(session.isCurrent(first), false)
  assert.equal(session.isCurrent(second), true)
})
test('clear cancels and prevents late response', () => {
  const session = createSearchSession()
  const request = session.begin()
  session.cancel()
  assert.equal(request.signal.aborted, true)
  assert.equal(session.isCurrent(request), false)
})
test('fresh search after clearing is independent', () => {
  const session = createSearchSession()
  const old = session.begin()
  session.cancel()
  session.cancel()
  const next = session.begin()
  assert.equal(session.isCurrent(old), false)
  assert.equal(session.isCurrent(next), true)
})
test('aborted signal cannot be treated as current', () => {
  const session = createSearchSession()
  const current = session.begin()
  current.abort()
  assert.equal(session.isCurrent(current), false)
})
test('independent workspaces cannot accept each other’s request', () => {
  const a = createSearchSession(), b = createSearchSession()
  const request = a.begin()
  assert.equal(b.isCurrent(request), false)
  assert.equal(a.isCurrent(request), true)
})
test('late completion after newer successful search is rejected', async () => {
  const session = createSearchSession()
  const old = session.begin()
  let release
  const slow = new Promise(resolve => { release = resolve }).then(() => session.isCurrent(old))
  const next = session.begin()
  assert.equal(session.isCurrent(next), true)
  release()
  assert.equal(await slow, false)
})
