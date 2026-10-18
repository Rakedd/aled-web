import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/server/supabase/database-types'
import { parseUserDataSnapshot, restoreUserDataSnapshot } from './restore-user-data-snapshot'

const readRequiredEnvironmentVariable = (variableName: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string => {
  const variableValue = process.env[variableName]
  if (!variableValue) throw new Error(`Missing environment variable ${variableName}`)
  return variableValue
}

const restoreBackupFile = async (backupFilePath: string | undefined): Promise<void> => {
  if (!backupFilePath) throw new Error('Usage: npx tsx scripts/restore-backup.ts <backup-file.json>')
  const snapshot = parseUserDataSnapshot(JSON.parse(await readFile(backupFilePath, 'utf8')))
  const serviceRoleClient = createClient<Database>(
    readRequiredEnvironmentVariable('SUPABASE_URL'),
    readRequiredEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { skippedOpportunityDecisionCount } = await restoreUserDataSnapshot(serviceRoleClient, snapshot)
  process.stdout.write(`Restored the data of user ${snapshot.userId} from ${backupFilePath}\n`)
  if (skippedOpportunityDecisionCount > 0) {
    process.stdout.write(`Skipped ${skippedOpportunityDecisionCount} opportunity decisions whose mission no longer exists\n`)
  }
}

restoreBackupFile(process.argv[2]).catch((restoreError: unknown) => {
  console.error(restoreError instanceof Error ? restoreError.message : restoreError)
  process.exitCode = 1
})
