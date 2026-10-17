import 'server-only'
import { Storage } from '@google-cloud/storage'

type BackupEnvironmentVariableName = 'GCS_BACKUP_BUCKET' | 'GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64'

type BackupServiceAccountKey = { project_id: string; client_email: string; private_key: string }

const BACKUP_CONTENT_TYPE = 'application/json'
const CREATE_ONLY_GENERATION = 0

const readBackupEnvironmentVariable = (variableName: BackupEnvironmentVariableName): string => {
  const variableValue = process.env[variableName]
  if (!variableValue) throw new Error(`Missing environment variable ${variableName}`)
  return variableValue
}

const isBackupServiceAccountKey = (candidate: unknown): candidate is BackupServiceAccountKey =>
  typeof candidate === 'object' &&
  candidate !== null &&
  'project_id' in candidate &&
  typeof candidate.project_id === 'string' &&
  'client_email' in candidate &&
  typeof candidate.client_email === 'string' &&
  'private_key' in candidate &&
  typeof candidate.private_key === 'string'

const readBackupServiceAccountKey = (): BackupServiceAccountKey => {
  const encodedServiceAccountKey = readBackupEnvironmentVariable('GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64')
  const decodedServiceAccountKey: unknown = JSON.parse(Buffer.from(encodedServiceAccountKey, 'base64').toString('utf8'))
  if (!isBackupServiceAccountKey(decodedServiceAccountKey)) {
    throw new Error('GCP_BACKUP_SERVICE_ACCOUNT_KEY_BASE64 is not a service account key')
  }
  return decodedServiceAccountKey
}

export const uploadBackupToGcs = async (objectKey: string, backupJson: string): Promise<void> => {
  const serviceAccountKey = readBackupServiceAccountKey()
  const backupStorage = new Storage({
    projectId: serviceAccountKey.project_id,
    credentials: { client_email: serviceAccountKey.client_email, private_key: serviceAccountKey.private_key },
  })
  await backupStorage
    .bucket(readBackupEnvironmentVariable('GCS_BACKUP_BUCKET'))
    .file(objectKey)
    .save(backupJson, {
      contentType: BACKUP_CONTENT_TYPE,
      resumable: false,
      preconditionOpts: { ifGenerationMatch: CREATE_ONLY_GENERATION },
    })
}
