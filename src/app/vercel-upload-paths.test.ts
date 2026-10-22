import fs from 'node:fs'
import path from 'node:path'

const VERCEL_VERSION_CONTROL_NAMES = ['.hg', '.git', '.gitmodules', '.svn', 'cvs']

const listEntryNames = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? [entry.name, ...listEntryNames(path.join(directory, entry.name))] : [entry.name],
  )

describe('app folder names', () => {
  it('avoids the names Vercel refuses to upload as version-control files, whatever their case', () => {
    const refusedNames = listEntryNames(path.join(process.cwd(), 'src/app')).filter((entryName) =>
      VERCEL_VERSION_CONTROL_NAMES.includes(entryName.toLowerCase()),
    )

    expect(refusedNames).toEqual([])
  })
})
