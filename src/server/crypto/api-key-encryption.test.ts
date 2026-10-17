import { randomBytes } from 'node:crypto'
import { decryptApiKey, encryptApiKey, readApiKeyEncryptionSecret } from './api-key-encryption'

jest.mock('server-only', () => ({}))

const secret = randomBytes(32).toString('base64')

describe('encryptApiKey and decryptApiKey', () => {
  it('round-trips an api key', () => {
    expect(decryptApiKey(encryptApiKey('sk-ant-api03-abc', secret), secret)).toBe('sk-ant-api03-abc')
  })

  it('never produces the same ciphertext twice', () => {
    expect(encryptApiKey('sk-ant-x', secret)).not.toBe(encryptApiKey('sk-ant-x', secret))
  })

  it('produces the v1:<iv>:<authTag>:<ciphertext> format without the plain key', () => {
    const encryptedApiKey = encryptApiKey('sk-ant-api03-abc', secret)
    const [version, initializationVector, authenticationTag, ciphertext] = encryptedApiKey.split(':')
    expect(version).toBe('v1')
    expect(Buffer.from(initializationVector, 'base64')).toHaveLength(12)
    expect(Buffer.from(authenticationTag, 'base64')).toHaveLength(16)
    expect(ciphertext).not.toHaveLength(0)
    expect(encryptedApiKey).not.toContain('sk-ant')
  })

  it('rejects a tampered ciphertext', () => {
    const [version, iv, tag] = encryptApiKey('sk-ant-x', secret).split(':')
    const tampered = [version, iv, tag, Buffer.from('zzzz').toString('base64')].join(':')
    expect(() => decryptApiKey(tampered, secret)).toThrow()
  })

  it('rejects a wrong secret', () => {
    expect(() => decryptApiKey(encryptApiKey('sk-ant-x', secret), randomBytes(32).toString('base64'))).toThrow()
  })

  it('rejects an unknown format version', () => {
    const [, iv, tag, cipher] = encryptApiKey('sk-ant-x', secret).split(':')
    expect(() => decryptApiKey(['v2', iv, tag, cipher].join(':'), secret)).toThrow('Unsupported encrypted api key format')
  })

  it('rejects a secret that does not decode to 32 bytes', () => {
    const shortSecret = randomBytes(16).toString('base64')
    expect(() => encryptApiKey('sk-ant-x', shortSecret)).toThrow(
      'API_KEY_ENCRYPTION_SECRET must be exactly 32 bytes encoded in base64',
    )
  })
})

describe('readApiKeyEncryptionSecret', () => {
  const originalSecret = process.env.API_KEY_ENCRYPTION_SECRET

  afterEach(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = originalSecret
  })

  it('returns a valid secret from the environment', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = secret
    expect(readApiKeyEncryptionSecret()).toBe(secret)
  })

  it('throws a configuration error when the secret is missing', () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET
    expect(() => readApiKeyEncryptionSecret()).toThrow('Missing environment variable API_KEY_ENCRYPTION_SECRET')
  })

  it('throws a configuration error when the secret does not decode to 32 bytes', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = randomBytes(31).toString('base64')
    expect(() => readApiKeyEncryptionSecret()).toThrow(
      'API_KEY_ENCRYPTION_SECRET must be exactly 32 bytes encoded in base64',
    )
  })
})
