import { execFileSync } from 'node:child_process'

const LOCAL_SUPABASE_VARIABLE_MAPPING: Record<string, string> = {
  SUPABASE_URL: 'API_URL',
  SUPABASE_ANON_KEY: 'ANON_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SERVICE_ROLE_KEY',
}

const parseDotenvOutput = (dotenvOutput: string): Record<string, string> =>
  Object.fromEntries(
    dotenvOutput
      .split('\n')
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(([, variableName, variableValue]) => [variableName, variableValue]),
  )

const readLocalSupabaseStatus = (): Record<string, string> =>
  parseDotenvOutput(
    execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  )

const isEveryVariableAlreadyDefined = Object.keys(LOCAL_SUPABASE_VARIABLE_MAPPING).every(
  (variableName) => process.env[variableName],
)

if (!isEveryVariableAlreadyDefined) {
  const localSupabaseStatus = readLocalSupabaseStatus()
  Object.entries(LOCAL_SUPABASE_VARIABLE_MAPPING).forEach(([projectVariableName, statusVariableName]) => {
    process.env[projectVariableName] ??= localSupabaseStatus[statusVariableName]
  })
}

const LOCAL_SUPABASE_HOSTNAMES = ['localhost', '127.0.0.1']

const isLocalSupabaseUrl = (supabaseUrl: string | undefined): boolean => {
  if (!supabaseUrl || !URL.canParse(supabaseUrl)) return false
  return LOCAL_SUPABASE_HOSTNAMES.includes(new URL(supabaseUrl).hostname)
}

if (!isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
  throw new Error(
    `Integration tests only run against a local Supabase (localhost or 127.0.0.1), got SUPABASE_URL="${process.env.SUPABASE_URL ?? ''}"`,
  )
}
