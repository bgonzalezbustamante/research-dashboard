// The signing tool's "Register on the Dashboard" link. The fixture is the exact link that the
// signing tool's own test produces, so a format change on either side fails here.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readRegistrationFragment } from '../../lib/documents/manifest.ts'

const fixture =
  'https://dashboard.bgonzalezbustamante.com/documents#register=eyJzY2hlbWFWZXJzaW9uIjoxLCJjb2RlIjoiYzVlMzNhMGM0YjM5NDc4YWI5NjI4YjEwNmY5ZjExOWUiLCJ0aXRsZSI6IkNlcnRpZmljYWNpw7NuIGFjYWTDqW1pY2EiLCJzaGEyNTYiOiJhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhIiwiaXNzdWVkQXQiOiIyMDI2LTExLTI0VDEwOjAwOjAwLjAwMFoiLCJjcmVhdGVkQXQiOiIyMDI2LTExLTI0VDEwOjAwOjAxLjAwMFoiLCJ2ZXJpZmljYXRpb25VcmwiOiJodHRwczovL3ZlcmlmeS5iZ29uemFsZXpidXN0YW1hbnRlLmNvbS8_aWQ9YzVlMzNhMGM0YjM5NDc4YWI5NjI4YjEwNmY5ZjExOWUiLCJvcmlnaW4iOiJuYXRpdmUiLCJoYXNoUHJvdmVuYW5jZSI6ImNhbGN1bGF0ZWQtZmluYWwtcGRmIiwic3RhdGUiOiJwZW5kaW5nLXJlZ2lzdHJhdGlvbiJ9'

const code =
  'c5e33a0c4b39478ab9628b106f9f119e'

const manifest = {
  schemaVersion: 1,
  code,
  title: 'Certificación académica',
  sha256: 'a'.repeat(64),
  issuedAt: '2026-11-24T10:00:00.000Z',
  createdAt: '2026-11-24T10:00:01.000Z',
  verificationUrl: `https://verify.bgonzalezbustamante.com/?id=${code}`,
  origin: 'native',
  hashProvenance: 'calculated-final-pdf',
  state: 'pending-registration',
}

function fragmentFor(value) {
  return '#register=' + Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

test('reads the signing tool link, keeping a non-ASCII title', () => {
  const result = readRegistrationFragment(new URL(fixture).hash)

  assert.equal(result?.ok, true)
  assert.deepEqual(result.value.value, {
    code,
    title: 'Certificación académica',
    issuedAt: '2026-11-24T10:00:00.000Z',
    sha256: 'a'.repeat(64),
  })
  assert.deepEqual(JSON.parse(result.value.text), manifest)
})

test('ignores an address without a registration fragment', () => {
  assert.equal(readRegistrationFragment(''), null)
  assert.equal(readRegistrationFragment('#'), null)
  assert.equal(readRegistrationFragment('#access_token=x'), null)
})

test('rejects a damaged or oversized link', () => {
  for (const hash of [
    '#register=',
    '#register=not base64!',
    '#register=' + Buffer.from([0xff, 0xfe]).toString('base64url'),
    '#register=' + 'A'.repeat(8001),
    fragmentFor(manifest) + '&x=1',
  ]) {
    const result = readRegistrationFragment(hash)
    assert.equal(result?.ok, false, hash.slice(0, 40))
  }
})

test('applies the same manifest checks as the upload form', () => {
  const wrongUrl = readRegistrationFragment(
    fragmentFor({ ...manifest, verificationUrl: 'https://example.org/?id=' + code })
  )
  assert.equal(wrongUrl?.ok, false)
  assert.match(wrongUrl.error, /verify\.bgonzalezbustamante\.com/)

  const legacy = readRegistrationFragment(
    fragmentFor({ ...manifest, schemaVersion: 2, origin: 'legacy' })
  )
  assert.equal(legacy?.ok, false)
})
