/**
 * @jest-environment node
 */
import type { ContactListItem, ContactProfile, Exchange, IntermediaryListItem, ProposedMission } from '@/domain/contacts'
import {
  deleteContactRow,
  findContactProfile,
  insertContact,
  listContactListItems,
  listContactListItemsForIntermediary,
  saveContactProfile,
} from '@/server/repositories/contacts-repository'
import { listExchangesForContact, listExchangesForIntermediary, recordContactExchange } from '@/server/repositories/exchanges-repository'
import { findIntermediaryListItem, listIntermediaryListItems } from '@/server/repositories/intermediaries-repository'
import {
  listProposedMissionsForContact,
  listProposedMissionsForIntermediary,
} from '@/server/repositories/job-applications-repository'
import { createServerSupabaseClient } from '@/server/supabase/create-server-supabase-client'
import { getAuthenticatedUser } from '@/server/supabase/get-authenticated-user'
import {
  addContactExchange,
  createContact,
  deleteContact,
  getContactPage,
  getIntermediaryPage,
  listContacts,
  listIntermediaries,
  updateContactProfile,
} from './contact-actions'

jest.mock('server-only', () => ({}))
jest.mock('@/server/supabase/get-authenticated-user', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/server/supabase/create-server-supabase-client', () => ({ createServerSupabaseClient: jest.fn() }))
jest.mock('@/server/repositories/contacts-repository', () => ({
  listContactListItems: jest.fn(),
  listContactListItemsForIntermediary: jest.fn(),
  findContactProfile: jest.fn(),
  insertContact: jest.fn(),
  saveContactProfile: jest.fn(),
  deleteContactRow: jest.fn(),
}))
jest.mock('@/server/repositories/intermediaries-repository', () => ({
  listIntermediaryListItems: jest.fn(),
  findIntermediaryListItem: jest.fn(),
}))
jest.mock('@/server/repositories/exchanges-repository', () => ({
  listExchangesForContact: jest.fn(),
  listExchangesForIntermediary: jest.fn(),
  recordContactExchange: jest.fn(),
}))
jest.mock('@/server/repositories/job-applications-repository', () => ({
  listProposedMissionsForContact: jest.fn(),
  listProposedMissionsForIntermediary: jest.fn(),
}))

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
const contactId = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f'
const intermediaryId = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const succeeded = { ok: true, data: null } as const
const validProfileInput = {
  fullName: ' Jean Dupont ',
  phone: null,
  email: null,
  linkedinUrl: null,
  intermediaryName: null,
  referredBy: null,
  notes: null,
}
const contactProfile: ContactProfile = {
  id: contactId,
  fullName: 'Jean Dupont',
  phone: null,
  email: null,
  linkedinUrl: null,
  intermediaryId: null,
  intermediaryName: null,
  referredBy: null,
  notes: null,
}
const intermediaryListItem: IntermediaryListItem = {
  id: intermediaryId,
  name: 'Michael Page',
  kind: 'agency',
  contactCount: 1,
  proposedMissionCount: 1,
  lastExchangeAt: null,
}
const contactListItem: ContactListItem = {
  id: contactId,
  fullName: 'Jean Dupont',
  intermediaryId,
  intermediaryName: 'Michael Page',
  phone: null,
  email: null,
  linkedinUrl: null,
  lastExchangeAt: null,
  proposedMissionCount: 1,
}
const exchange: Exchange = {
  id: 'exchange-1',
  occurredAt: new Date('2026-10-01T10:00:00.000Z'),
  kind: 'call',
  summary: 'Appel de suivi',
  jobApplicationId: null,
  jobApplicationTitle: null,
  contactId,
  contactName: 'Jean Dupont',
}
const proposedMission: ProposedMission = {
  jobApplicationId: 'application-1',
  title: 'Mission React',
  appliedOn: new Date('2026-09-20T00:00:00.000Z'),
  endClientLabel: null,
  contactName: 'Jean Dupont',
  status: 'applied',
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getAuthenticatedUser).mockResolvedValue({ id: 'user-1', email: 'ada@example.com' })
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient)
})

describe('listContacts', () => {
  it('lists the contacts of the authenticated user', async () => {
    jest.mocked(listContactListItems).mockResolvedValue([contactListItem])
    await expect(listContacts()).resolves.toEqual({ ok: true, data: [contactListItem] })
    expect(listContactListItems).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })

  it('reports a load failure when the repository throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(listContactListItems).mockRejectedValue(new Error('boom'))
    await expect(listContacts()).resolves.toEqual({
      ok: false,
      errorMessage: 'Impossible de charger ces informations pour le moment. Réessaie dans quelques minutes.',
    })
  })
})

describe('listIntermediaries', () => {
  it('lists the intermediaries of the authenticated user', async () => {
    jest.mocked(listIntermediaryListItems).mockResolvedValue([intermediaryListItem])
    await expect(listIntermediaries()).resolves.toEqual({ ok: true, data: [intermediaryListItem] })
    expect(listIntermediaryListItems).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1')
  })
})

describe('getContactPage', () => {
  it('loads the contact page data in one result', async () => {
    jest.mocked(findContactProfile).mockResolvedValue({ ok: true, data: contactProfile })
    jest.mocked(listProposedMissionsForContact).mockResolvedValue([proposedMission])
    jest.mocked(listExchangesForContact).mockResolvedValue([exchange])
    await expect(getContactPage(contactId)).resolves.toEqual({
      ok: true,
      data: { profile: contactProfile, proposedMissions: [proposedMission], exchanges: [exchange] },
    })
    expect(listExchangesForContact).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', contactId)
  })

  it('rejects a malformed contact id without touching the database', async () => {
    await expect(getContactPage('jean')).resolves.toEqual({ ok: false, errorMessage: 'Contact introuvable' })
    expect(findContactProfile).not.toHaveBeenCalled()
    expect(createServerSupabaseClient).not.toHaveBeenCalled()
  })

  it('stops at the profile when the contact does not exist', async () => {
    jest.mocked(findContactProfile).mockResolvedValue({ ok: false, errorMessage: 'Contact introuvable' })
    await expect(getContactPage(contactId)).resolves.toEqual({ ok: false, errorMessage: 'Contact introuvable' })
    expect(listExchangesForContact).not.toHaveBeenCalled()
    expect(listProposedMissionsForContact).not.toHaveBeenCalled()
  })
})

describe('getIntermediaryPage', () => {
  it('loads the intermediary page data in one result', async () => {
    jest.mocked(findIntermediaryListItem).mockResolvedValue({ ok: true, data: intermediaryListItem })
    jest.mocked(listContactListItemsForIntermediary).mockResolvedValue([contactListItem])
    jest.mocked(listExchangesForIntermediary).mockResolvedValue([exchange])
    jest.mocked(listProposedMissionsForIntermediary).mockResolvedValue([proposedMission])
    await expect(getIntermediaryPage(intermediaryId)).resolves.toEqual({
      ok: true,
      data: {
        intermediary: intermediaryListItem,
        contacts: [contactListItem],
        exchanges: [exchange],
        proposedMissions: [proposedMission],
      },
    })
  })

  it('never lets a malformed intermediary id reach the repositories', async () => {
    await expect(getIntermediaryPage('a,b.eq.c')).resolves.toEqual({
      ok: false,
      errorMessage: 'Intermédiaire introuvable',
    })
    expect(findIntermediaryListItem).not.toHaveBeenCalled()
    expect(listExchangesForIntermediary).not.toHaveBeenCalled()
    expect(listContactListItemsForIntermediary).not.toHaveBeenCalled()
    expect(listProposedMissionsForIntermediary).not.toHaveBeenCalled()
  })

  it('stops at the intermediary when it does not exist', async () => {
    jest.mocked(findIntermediaryListItem).mockResolvedValue({ ok: false, errorMessage: 'Intermédiaire introuvable' })
    await expect(getIntermediaryPage(intermediaryId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Intermédiaire introuvable',
    })
    expect(listExchangesForIntermediary).not.toHaveBeenCalled()
  })
})

describe('createContact', () => {
  it('creates a contact from the validated input', async () => {
    jest.mocked(insertContact).mockResolvedValue({ ok: true, data: { id: contactId } })
    await expect(createContact(validProfileInput)).resolves.toEqual({ ok: true, data: { id: contactId } })
    expect(insertContact).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', { ...validProfileInput, fullName: 'Jean Dupont' })
  })

  it('rejects an invalid profile input', async () => {
    const result = await createContact({ ...validProfileInput, fullName: '   ' })
    expect(result.ok).toBe(false)
    expect(insertContact).not.toHaveBeenCalled()
  })
})

describe('updateContactProfile', () => {
  it('saves the validated profile', async () => {
    jest.mocked(saveContactProfile).mockResolvedValue(succeeded)
    await expect(updateContactProfile(contactId, validProfileInput)).resolves.toEqual(succeeded)
    expect(saveContactProfile).toHaveBeenCalledWith(fakeSupabaseClient, 'user-1', contactId, {
      ...validProfileInput,
      fullName: 'Jean Dupont',
    })
  })

  it('rejects a malformed contact id', async () => {
    await expect(updateContactProfile('jean', validProfileInput)).resolves.toEqual({
      ok: false,
      errorMessage: 'Contact introuvable',
    })
    expect(saveContactProfile).not.toHaveBeenCalled()
  })

  it('rejects an invalid profile input', async () => {
    const result = await updateContactProfile(contactId, { ...validProfileInput, email: 'jean@' })
    expect(result.ok).toBe(false)
    expect(saveContactProfile).not.toHaveBeenCalled()
  })
})

describe('deleteContact', () => {
  it('deletes the contact', async () => {
    jest.mocked(deleteContactRow).mockResolvedValue(true)
    await expect(deleteContact(contactId)).resolves.toEqual(succeeded)
    expect(deleteContactRow).toHaveBeenCalledWith(fakeSupabaseClient, contactId)
  })

  it('reports not found when deleting an unknown contact', async () => {
    jest.mocked(deleteContactRow).mockResolvedValue(false)
    await expect(deleteContact(contactId)).resolves.toEqual({ ok: false, errorMessage: 'Contact introuvable' })
  })

  it('rejects a malformed contact id', async () => {
    await expect(deleteContact('jean')).resolves.toEqual({ ok: false, errorMessage: 'Contact introuvable' })
    expect(deleteContactRow).not.toHaveBeenCalled()
  })
})

describe('addContactExchange', () => {
  it('records the validated exchange', async () => {
    jest.mocked(recordContactExchange).mockResolvedValue(succeeded)
    await expect(
      addContactExchange(contactId, { kind: 'call', summary: ' Appel ', jobApplicationId: null }),
    ).resolves.toEqual(succeeded)
    expect(recordContactExchange).toHaveBeenCalledWith(
      fakeSupabaseClient,
      'user-1',
      contactId,
      expect.objectContaining({ kind: 'call', summary: 'Appel', jobApplicationId: null }),
    )
  })

  it('rejects a malformed contact id', async () => {
    await expect(
      addContactExchange('jean', { kind: 'call', summary: 'Appel', jobApplicationId: null }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Contact introuvable' })
    expect(recordContactExchange).not.toHaveBeenCalled()
  })

  it('rejects an invalid exchange', async () => {
    const result = await addContactExchange(contactId, {
      kind: 'call',
      summary: '',
      jobApplicationId: null,
    })
    expect(result.ok).toBe(false)
    expect(recordContactExchange).not.toHaveBeenCalled()
  })
})
