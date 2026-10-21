import {
  INITIAL_CONTACTS_SORT,
  filterContacts,
  filterIntermediaries,
  normalizePhoneNumberForSearch,
  sortContacts,
  sortIntermediaries,
  toggleListSort,
} from './contact-search'
import type { ContactListItem, IntermediaryListItem } from './contacts'

const buildContact = (overrides: Partial<ContactListItem>): ContactListItem => ({
  id: 'contact-id',
  fullName: 'Alice Martin',
  intermediaryId: null,
  intermediaryName: null,
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 0,
  ...overrides,
})

const buildIntermediary = (overrides: Partial<IntermediaryListItem>): IntermediaryListItem => ({
  id: 'intermediary-id',
  name: 'Alpha',
  kind: null,
  contactCount: 0,
  proposedMissionCount: 0,
  lastExchangeAt: null,
  ...overrides,
})

describe('normalizePhoneNumberForSearch', () => {
  it.each(['+33 6 12 34 56 78', '06.12.34.56.78', '0033612345678', '06-12-34-56-78'])(
    'normalizes %s to 0612345678',
    (phoneNumber) => {
      expect(normalizePhoneNumberForSearch(phoneNumber)).toBe('0612345678')
    },
  )
})

describe('filterContacts', () => {
  const contacts = [
    buildContact({
      id: 'a',
      fullName: 'Alice Martin',
      phone: '+33 6 12 34 56 78',
      intermediaryName: 'Société Générale',
    }),
    buildContact({ id: 'b', fullName: 'Bob Durand', phone: null }),
  ]

  it('returns everything for a blank query', () => {
    expect(filterContacts(contacts, '   ')).toEqual(contacts)
  })

  it('finds a contact by a fragment of its phone number', () => {
    expect(filterContacts(contacts, '3456').map((contact) => contact.id)).toEqual(['a'])
  })

  it('ignores phone matching for queries with fewer than three digits', () => {
    expect(filterContacts(contacts, '12')).toEqual([])
  })

  it('finds a contact by agency name, ignoring accents and case', () => {
    expect(filterContacts(contacts, 'societe').map((contact) => contact.id)).toEqual(['a'])
  })

  it('finds a contact stored as +33 when searching with a 06 number', () => {
    const storedInternationally = [buildContact({ id: 'a', phone: '+33 6 12 34 56 78' })]
    expect(filterContacts(storedInternationally, '06 12 34').map((contact) => contact.id)).toEqual(['a'])
  })

  it('finds a contact stored as 06 when searching with a +33 number', () => {
    const storedLocally = [buildContact({ id: 'a', phone: '06 12 34 56 78' })]
    expect(filterContacts(storedLocally, '+33 6 12 34').map((contact) => contact.id)).toEqual(['a'])
  })

  it('finds a contact by name', () => {
    expect(filterContacts(contacts, 'DURAND').map((contact) => contact.id)).toEqual(['b'])
  })
})

describe('sortContacts', () => {
  const contacts = [
    buildContact({ id: 'none', lastExchangeAt: null }),
    buildContact({ id: 'old', lastExchangeAt: new Date('2026-01-01') }),
    buildContact({ id: 'recent', lastExchangeAt: new Date('2026-03-01') }),
  ]

  it('sorts by last exchange descending and keeps contacts without exchange last', () => {
    expect(sortContacts(contacts, { key: 'lastExchangeAt', direction: 'desc' }).map((contact) => contact.id)).toEqual([
      'recent',
      'old',
      'none',
    ])
  })

  it('sorts by last exchange ascending and keeps contacts without exchange last', () => {
    expect(sortContacts(contacts, { key: 'lastExchangeAt', direction: 'asc' }).map((contact) => contact.id)).toEqual([
      'old',
      'recent',
      'none',
    ])
  })

  it('sorts names ignoring accents and case', () => {
    const namedContacts = [buildContact({ id: 'z', fullName: 'Zoé' }), buildContact({ id: 'e', fullName: 'élodie' })]
    expect(sortContacts(namedContacts, { key: 'fullName', direction: 'asc' }).map((contact) => contact.id)).toEqual([
      'e',
      'z',
    ])
  })

  it('does not mutate the input', () => {
    const copy = [...contacts]
    sortContacts(contacts, INITIAL_CONTACTS_SORT)
    expect(contacts).toEqual(copy)
  })
})

describe('intermediaries', () => {
  const intermediaries = [
    buildIntermediary({ id: 'a', name: 'Alpha', contactCount: 3 }),
    buildIntermediary({ id: 'b', name: 'Bêta', contactCount: 1 }),
  ]

  it('filters by name only', () => {
    expect(filterIntermediaries(intermediaries, 'beta').map((intermediary) => intermediary.id)).toEqual(['b'])
    expect(filterIntermediaries(intermediaries, '  ')).toEqual(intermediaries)
  })

  it('sorts by contact count descending', () => {
    expect(
      sortIntermediaries(intermediaries, {
        key: 'contactCount',
        direction: 'desc',
      }).map((item) => item.id),
    ).toEqual(['a', 'b'])
  })
})

describe('toggleListSort', () => {
  it('toggles a new sort key ascending then descending', () => {
    const firstClick = toggleListSort(INITIAL_CONTACTS_SORT, 'fullName')
    expect(firstClick).toEqual({ key: 'fullName', direction: 'asc' })
    expect(toggleListSort(firstClick, 'fullName')).toEqual({
      key: 'fullName',
      direction: 'desc',
    })
  })
})
