import { formatEndClientLabel, normalizeEntityName } from './entity-names'

describe('normalizeEntityName', () => {
  it('ignores case, surrounding spaces and repeated inner spaces', () => {
    expect(normalizeEntityName('  Agence   X ')).toBe(normalizeEntityName('agence x'))
    expect(normalizeEntityName('  Agence   X ')).toBe('agence x')
  })

  it('removes accents', () => {
    expect(normalizeEntityName('Société Générale')).toBe('societe generale')
  })

  it('collapses tabs and line breaks like spaces', () => {
    expect(normalizeEntityName('BNP\tParibas\nAM')).toBe('bnp paribas am')
  })
})

describe('formatEndClientLabel', () => {
  it('shows the parent group in parentheses', () => {
    expect(formatEndClientLabel('BNP Paribas AM', 'BNP Paribas')).toBe('BNP Paribas AM (BNP Paribas)')
  })

  it('shows the name alone without a parent group', () => {
    expect(formatEndClientLabel('Banque Z', null)).toBe('Banque Z')
  })
})
