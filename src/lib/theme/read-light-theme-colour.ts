import fs from 'fs'
import path from 'path'

const GLOBALS_CSS_PATH = path.join(process.cwd(), 'src/app/globals.css')

const readLightThemeDeclarations = (): Map<string, string> => {
  const globalsCss = fs.readFileSync(GLOBALS_CSS_PATH, 'utf8')
  const lightThemeBlock = /:root\s*{([^}]*)}/.exec(globalsCss)?.[1] ?? ''
  return new Map(
    [...lightThemeBlock.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(([, tokenName, tokenValue]) => [
      tokenName,
      tokenValue.trim(),
    ]),
  )
}

export const readLightThemeColour = (tokenName: string): string => {
  const lightThemeDeclarations = readLightThemeDeclarations()
  const resolveToken = (currentTokenName: string): string => {
    const tokenValue = lightThemeDeclarations.get(currentTokenName)
    if (tokenValue === undefined) throw new Error(`Unknown light theme colour token --${currentTokenName}`)
    const referencedTokenName = /^var\(--([a-z0-9-]+)\)$/.exec(tokenValue)?.[1]
    return referencedTokenName ? resolveToken(referencedTokenName) : tokenValue
  }
  return resolveToken(tokenName)
}
