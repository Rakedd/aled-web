import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const ENCRYPTED_API_KEY_FORMAT_VERSION = 'v1'
const ENCRYPTION_KEY_LENGTH_IN_BYTES = 32
const INITIALIZATION_VECTOR_LENGTH_IN_BYTES = 12
const AUTHENTICATION_TAG_LENGTH_IN_BYTES = 16
const ENCRYPTION_SECRET_ENVIRONMENT_VARIABLE = 'API_KEY_ENCRYPTION_SECRET'
const INVALID_ENCRYPTION_SECRET_MESSAGE = `${ENCRYPTION_SECRET_ENVIRONMENT_VARIABLE} must be exactly 32 bytes encoded in base64`

const decodeEncryptionKey = (base64Secret: string): Buffer => {
  const encryptionKey = Buffer.from(base64Secret, 'base64')
  if (encryptionKey.length !== ENCRYPTION_KEY_LENGTH_IN_BYTES) throw new Error(INVALID_ENCRYPTION_SECRET_MESSAGE)
  return encryptionKey
}

export const readApiKeyEncryptionSecret = (): string => {
  const base64Secret = process.env[ENCRYPTION_SECRET_ENVIRONMENT_VARIABLE]
  if (!base64Secret) throw new Error(`Missing environment variable ${ENCRYPTION_SECRET_ENVIRONMENT_VARIABLE}`)
  decodeEncryptionKey(base64Secret)
  return base64Secret
}

export const encryptApiKey = (plainApiKey: string, base64Secret: string): string => {
  const encryptionKey = decodeEncryptionKey(base64Secret)
  const initializationVector = randomBytes(INITIALIZATION_VECTOR_LENGTH_IN_BYTES)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, initializationVector, {
    authTagLength: AUTHENTICATION_TAG_LENGTH_IN_BYTES,
  })
  const ciphertext = Buffer.concat([cipher.update(plainApiKey, 'utf8'), cipher.final()])
  const authenticationTag = cipher.getAuthTag()
  return [
    ENCRYPTED_API_KEY_FORMAT_VERSION,
    initializationVector.toString('base64'),
    authenticationTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

export const decryptApiKey = (encryptedApiKey: string, base64Secret: string): string => {
  const encryptionKey = decodeEncryptionKey(base64Secret)
  const [version, base64InitializationVector, base64AuthenticationTag, base64Ciphertext, ...unexpectedParts] =
    encryptedApiKey.split(':')
  const hasExpectedShape =
    version === ENCRYPTED_API_KEY_FORMAT_VERSION &&
    Boolean(base64InitializationVector) &&
    Boolean(base64AuthenticationTag) &&
    Boolean(base64Ciphertext) &&
    unexpectedParts.length === 0
  if (!hasExpectedShape) throw new Error('Unsupported encrypted api key format')
  const authenticationTag = Buffer.from(base64AuthenticationTag, 'base64')
  if (authenticationTag.length !== AUTHENTICATION_TAG_LENGTH_IN_BYTES) throw new Error('Invalid authentication tag length')
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    encryptionKey,
    Buffer.from(base64InitializationVector, 'base64'),
    { authTagLength: AUTHENTICATION_TAG_LENGTH_IN_BYTES },
  )
  decipher.setAuthTag(authenticationTag)
  return Buffer.concat([decipher.update(Buffer.from(base64Ciphertext, 'base64')), decipher.final()]).toString('utf8')
}
