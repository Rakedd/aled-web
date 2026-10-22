import {
  END_CLIENT_PARENT_CYCLE_MESSAGE,
  validateContactDetailValues,
  validateContactDetailsInput,
  validateEntitySearchArguments,
  validateIntermediaryKind,
  wouldCreateEndClientParentCycle,
} from './entities'

describe('wouldCreateEndClientParentCycle', () => {
  const endClientParentLinks = [
    { id: 'group', parentEndClientId: null },
    { id: 'subsidiary', parentEndClientId: 'group' },
    { id: 'team', parentEndClientId: 'subsidiary' },
    { id: 'other-client', parentEndClientId: null },
  ]

  it('detects an end client becoming its own parent', () => {
    expect(wouldCreateEndClientParentCycle(endClientParentLinks, 'group', 'group')).toBe(true)
  })

  it('detects a group becoming the subsidiary of its own subsidiary', () => {
    expect(wouldCreateEndClientParentCycle(endClientParentLinks, 'group', 'subsidiary')).toBe(true)
  })

  it('walks the whole chain of parents', () => {
    expect(wouldCreateEndClientParentCycle(endClientParentLinks, 'group', 'team')).toBe(true)
  })

  it('accepts a parent outside the chain', () => {
    expect(wouldCreateEndClientParentCycle(endClientParentLinks, 'team', 'other-client')).toBe(false)
    expect(wouldCreateEndClientParentCycle(endClientParentLinks, 'other-client', 'team')).toBe(false)
  })

  it('stops on an already broken chain instead of looping forever', () => {
    const brokenChain = [
      { id: 'first', parentEndClientId: 'second' },
      { id: 'second', parentEndClientId: 'first' },
      { id: 'outsider', parentEndClientId: null },
    ]
    expect(wouldCreateEndClientParentCycle(brokenChain, 'outsider', 'first')).toBe(false)
  })

  it('exposes the cycle message shown to the user', () => {
    expect(END_CLIENT_PARENT_CYCLE_MESSAGE).toBe('Un groupe ne peut pas être sa propre filiale')
  })
})

describe('validateContactDetailsInput', () => {
  const validContactDetailsInput = {
    fullName: ' Jean Dupont ',
    phone: ' 06 12 34 56 78 ',
    email: ' jean@agence-x.fr ',
    linkedinUrl: ' https://www.linkedin.com/in/jean ',
  }

  it('trims the fields and keeps only the known ones', () => {
    expect(validateContactDetailsInput({ ...validContactDetailsInput, id: 'forged', user_id: 'forged' })).toEqual({
      ok: true,
      data: {
        fullName: 'Jean Dupont',
        phone: '06 12 34 56 78',
        email: 'jean@agence-x.fr',
        linkedinUrl: 'https://www.linkedin.com/in/jean',
      },
    })
  })

  it('turns empty optional fields into null', () => {
    expect(validateContactDetailsInput({ fullName: 'Jean', phone: ' ', email: '', linkedinUrl: null })).toEqual({
      ok: true,
      data: { fullName: 'Jean', phone: null, email: null, linkedinUrl: null },
    })
  })

  it('requires a name', () => {
    expect(validateContactDetailsInput({ ...validContactDetailsInput, fullName: '  ' })).toEqual({
      ok: false,
      errorMessage: 'Le nom du contact est obligatoire',
    })
  })

  it('rejects a name whose normalized form is empty', () => {
    expect(validateContactDetailsInput({ ...validContactDetailsInput, fullName: '\u0301' })).toEqual({
      ok: false,
      errorMessage: 'Nom du contact : nom invalide',
    })
  })

  it('rejects a malformed e-mail', () => {
    expect(validateContactDetailsInput({ ...validContactDetailsInput, email: 'jean@' })).toEqual({
      ok: false,
      errorMessage: 'E-mail invalide',
    })
  })

  it.each(['http://www.linkedin.com/in/jean', 'javascript:alert(1)', 'linkedin.com/in/jean'])(
    'rejects the linkedin url %p',
    (linkedinUrl) => {
      expect(validateContactDetailsInput({ ...validContactDetailsInput, linkedinUrl })).toEqual({
        ok: false,
        errorMessage: 'Lien LinkedIn invalide',
      })
    },
  )

  it('rejects a payload that is not an object', () => {
    expect(validateContactDetailsInput('Jean')).toEqual({ ok: false, errorMessage: 'Contact invalide' })
  })
})

describe('validateIntermediaryKind', () => {
  it('accepts a known intermediary kind', () => {
    expect(validateIntermediaryKind('esn')).toEqual({ ok: true, data: 'esn' })
  })

  it('rejects an unknown intermediary kind', () => {
    expect(validateIntermediaryKind('bank')).toEqual({ ok: false, errorMessage: "Type d'intermédiaire invalide" })
  })
})

describe('validateEntitySearchArguments', () => {
  it('accepts a known entity kind and a query', () => {
    expect(validateEntitySearchArguments('end_client', 'bnp')).toEqual({
      ok: true,
      data: { entityKind: 'end_client', query: 'bnp' },
    })
  })

  it('rejects an unknown entity kind', () => {
    expect(validateEntitySearchArguments('profiles', 'bnp')).toEqual({ ok: false, errorMessage: 'Recherche invalide' })
  })

  it('rejects an overly long query', () => {
    expect(validateEntitySearchArguments('contact', 'a'.repeat(201))).toEqual({
      ok: false,
      errorMessage: 'Recherche invalide',
    })
  })
})

describe('validateContactDetailValues', () => {
  it('validates contact detail values without a name', () => {
    expect(
      validateContactDetailValues({ phone: ' 06 12 34 56 78 ', email: '', linkedinUrl: null, fullName: 'ignored' }),
    ).toEqual({ ok: true, data: { phone: '06 12 34 56 78', email: null, linkedinUrl: null } })
  })

  it('applies the phone, e-mail and LinkedIn rules', () => {
    expect(validateContactDetailValues({ phone: null, email: 'nope', linkedinUrl: null })).toEqual({
      ok: false,
      errorMessage: 'E-mail invalide',
    })
    expect(validateContactDetailValues('nope')).toEqual({ ok: false, errorMessage: 'Contact invalide' })
  })
})
