import { randomUUID } from 'node:crypto'
import {
  assignEndClientParent,
  findContactDetails,
  saveContactDetails,
  saveIntermediaryKind,
  searchEntitySuggestions,
} from '@/server/repositories/entities-repository'
import {
  findJobApplicationOverview,
  listJobApplicationItems,
  updateJobApplicationRow,
} from '@/server/repositories/job-applications-repository'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

const createTestUser = () => createSignedInTestClient(`entities-${randomUUID()}@test.local`)

type TestUser = Awaited<ReturnType<typeof createTestUser>>

const findEndClientIdByName = async (user: TestUser, endClientName: string): Promise<string> => {
  const { data } = await user.client.from('end_clients').select('id').eq('name', endClientName).single()
  if (!data) throw new Error(`End client ${endClientName} not found`)
  return data.id
}

const findContactIdByName = async (user: TestUser, contactName: string): Promise<string> => {
  const { data } = await user.client.from('contacts').select('id').eq('full_name', contactName).single()
  if (!data) throw new Error(`Contact ${contactName} not found`)
  return data.id
}

describe('entities repository', () => {
  it('creates a subsidiary linked to its parent group', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      endClientName: 'BNP Paribas AM',
      endClientParentName: 'BNP Paribas',
    })

    const { data: endClients } = await user.client
      .from('end_clients')
      .select('id, name, parent_end_client_id')
      .eq('user_id', user.userId)
      .order('name')
    expect(endClients).toHaveLength(2)
    const [groupEndClient, subsidiaryEndClient] = endClients ?? []
    expect(groupEndClient).toMatchObject({ name: 'BNP Paribas', parent_end_client_id: null })
    expect(subsidiaryEndClient).toMatchObject({ name: 'BNP Paribas AM', parent_end_client_id: groupEndClient.id })
    await expect(findJobApplicationOverview(user.client, user.userId, jobApplicationId)).resolves.toMatchObject({
      ok: true,
      data: { endClientLabel: 'BNP Paribas AM (BNP Paribas)', endClientParentName: 'BNP Paribas' },
    })
  })

  it('refuses to make a group the subsidiary of its own subsidiary', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, {
      endClientName: 'BNP Paribas AM',
      endClientParentName: 'BNP Paribas',
    })
    const groupId = await findEndClientIdByName(user, 'BNP Paribas')
    const subsidiaryId = await findEndClientIdByName(user, 'BNP Paribas AM')

    await expect(assignEndClientParent(user.client, user.userId, groupId, subsidiaryId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Un groupe ne peut pas être sa propre filiale',
    })
    const { data: group } = await user.client.from('end_clients').select('parent_end_client_id').eq('id', groupId).single()
    expect(group).toEqual({ parent_end_client_id: null })
  })

  it('detects a cycle along the whole chain of parents', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, { endClientName: 'Filiale', endClientParentName: 'Groupe' })
    await createJobApplicationOrFail(user.client, user.userId, { endClientName: 'Équipe', endClientParentName: 'Filiale' })
    const groupId = await findEndClientIdByName(user, 'Groupe')
    const teamId = await findEndClientIdByName(user, 'Équipe')

    await expect(assignEndClientParent(user.client, user.userId, groupId, teamId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Un groupe ne peut pas être sa propre filiale',
    })
    await expect(
      updateJobApplicationRow(
        user.client,
        user.userId,
        await createJobApplicationOrFail(user.client, user.userId),
        { endClientName: 'Groupe', endClientParentName: 'Équipe' },
      ),
    ).resolves.toEqual({ ok: false, errorMessage: 'Un groupe ne peut pas être sa propre filiale' })
  })

  it('applies a parent group or contact details sent alone to the current entities of the job application', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, {
      endClientName: 'BNP Paribas AM',
      contactName: 'Jean Dupont',
    })

    await expect(
      updateJobApplicationRow(user.client, user.userId, jobApplicationId, {
        endClientParentName: 'BNP Paribas',
        contactEmail: 'jean@agence-x.fr',
      }),
    ).resolves.toEqual({ ok: true, data: null })

    await expect(findJobApplicationOverview(user.client, user.userId, jobApplicationId)).resolves.toMatchObject({
      ok: true,
      data: { endClientLabel: 'BNP Paribas AM (BNP Paribas)', contactName: 'Jean Dupont' },
    })
    await expect(findContactDetails(user.client, user.userId, await findContactIdByName(user, 'Jean Dupont'))).resolves.toMatchObject({
      ok: true,
      data: { email: 'jean@agence-x.fr' },
    })
  })

  it('sets and removes the parent of an end client', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, { endClientName: 'Banque Z' })
    await createJobApplicationOrFail(user.client, user.userId, { endClientName: 'Groupe Z' })
    const bankId = await findEndClientIdByName(user, 'Banque Z')
    const groupId = await findEndClientIdByName(user, 'Groupe Z')

    await expect(assignEndClientParent(user.client, user.userId, bankId, groupId)).resolves.toEqual({ ok: true, data: null })
    await expect(searchEntitySuggestions(user.client, user.userId, { entityKind: 'end_client', query: 'banque' })).resolves.toEqual([
      { id: bankId, name: 'Banque Z', label: 'Banque Z (Groupe Z)', parentName: 'Groupe Z' },
    ])

    await expect(assignEndClientParent(user.client, user.userId, bankId, null)).resolves.toEqual({ ok: true, data: null })
    await expect(searchEntitySuggestions(user.client, user.userId, { entityKind: 'end_client', query: 'banque' })).resolves.toEqual([
      { id: bankId, name: 'Banque Z', label: 'Banque Z', parentName: null },
    ])
  })

  it('labels end client suggestions as "Subsidiary (Group)"', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, {
      endClientName: 'BNP Paribas AM',
      endClientParentName: 'BNP Paribas',
    })
    await createJobApplicationOrFail(user.client, user.userId, { endClientName: 'Société Générale' })

    const suggestions = await searchEntitySuggestions(user.client, user.userId, { entityKind: 'end_client', query: 'bnp' })

    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(['BNP Paribas', 'BNP Paribas AM (BNP Paribas)'])
    expect(suggestions.map(({ name, parentName }) => ({ name, parentName }))).toEqual([
      { name: 'BNP Paribas', parentName: null },
      { name: 'BNP Paribas AM', parentName: 'BNP Paribas' },
    ])
  })

  it('finds intermediaries and contacts without caring about case or accents', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, {
      intermediaryName: 'Société Conseil',
      contactName: 'Hélène Martin',
    })

    await expect(
      searchEntitySuggestions(user.client, user.userId, { entityKind: 'intermediary', query: 'SOCIETE' }),
    ).resolves.toEqual([
      { id: expect.any(String), name: 'Société Conseil', label: 'Société Conseil', parentName: null },
    ])
    await expect(
      searchEntitySuggestions(user.client, user.userId, { entityKind: 'contact', query: 'helene' }),
    ).resolves.toEqual([
      { id: expect.any(String), name: 'Hélène Martin', label: 'Hélène Martin', parentName: null },
    ])
    await expect(
      searchEntitySuggestions(user.client, user.userId, { entityKind: 'contact', query: '%' }),
    ).resolves.toEqual([])
    await expect(
      searchEntitySuggestions(user.client, user.userId, { entityKind: 'contact', query: '   ' }),
    ).resolves.toEqual([])
  })

  it('reads and updates the details of a contact', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, { contactName: 'Jean Dupont' })
    const contactId = await findContactIdByName(user, 'Jean Dupont')

    await expect(
      saveContactDetails(user.client, user.userId, contactId, {
        fullName: 'Jean-Pierre Dupont',
        phone: '06 12 34 56 78',
        email: 'jp@agence-x.fr',
        linkedinUrl: 'https://www.linkedin.com/in/jpdupont',
      }),
    ).resolves.toEqual({ ok: true, data: null })

    await expect(findContactDetails(user.client, user.userId, contactId)).resolves.toEqual({
      ok: true,
      data: {
        id: contactId,
        fullName: 'Jean-Pierre Dupont',
        phone: '06 12 34 56 78',
        email: 'jp@agence-x.fr',
        linkedinUrl: 'https://www.linkedin.com/in/jpdupont',
      },
    })
    await expect(
      searchEntitySuggestions(user.client, user.userId, { entityKind: 'contact', query: 'jean-pierre' }),
    ).resolves.toEqual([
      { id: contactId, name: 'Jean-Pierre Dupont', label: 'Jean-Pierre Dupont', parentName: null },
    ])
  })

  it('refuses to rename a contact to the name of another contact', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, { contactName: 'Jean Dupont' })
    await createJobApplicationOrFail(user.client, user.userId, { contactName: 'Marie Curie' })
    const contactId = await findContactIdByName(user, 'Jean Dupont')

    await expect(
      saveContactDetails(user.client, user.userId, contactId, {
        fullName: 'marie curie',
        phone: null,
        email: null,
        linkedinUrl: null,
      }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Un autre contact porte déjà ce nom' })
  })

  it('updates the kind of an intermediary', async () => {
    const user = await createTestUser()
    await createJobApplicationOrFail(user.client, user.userId, { intermediaryName: 'Agence X' })
    const { data: intermediary } = await user.client.from('intermediaries').select('id').single()

    await expect(saveIntermediaryKind(user.client, user.userId, intermediary!.id, 'esn')).resolves.toEqual({
      ok: true,
      data: null,
    })

    const { data: updatedIntermediary } = await user.client.from('intermediaries').select('kind').single()
    expect(updatedIntermediary).toEqual({ kind: 'esn' })
  })

  it('exposes the intermediary kind in the job application overview and list', async () => {
    const user = await createTestUser()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId, { intermediaryName: 'Agence X' })
    const jobApplicationWithoutIntermediaryId = await createJobApplicationOrFail(user.client, user.userId)
    const { data: intermediary } = await user.client.from('intermediaries').select('id').single()

    const overviewBeforeKindIsSet = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
    expect(overviewBeforeKindIsSet.ok && overviewBeforeKindIsSet.data.intermediaryKind).toBeNull()

    await saveIntermediaryKind(user.client, user.userId, intermediary!.id, 'platform')

    const overviewAfterKindIsSet = await findJobApplicationOverview(user.client, user.userId, jobApplicationId)
    expect(overviewAfterKindIsSet.ok && overviewAfterKindIsSet.data.intermediaryKind).toBe('platform')
    const listItems = await listJobApplicationItems(user.client, user.userId)
    expect(
      listItems.map((listItem) => ({ id: listItem.id, intermediaryKind: listItem.intermediaryKind })),
    ).toEqual(
      expect.arrayContaining([
        { id: jobApplicationId, intermediaryKind: 'platform' },
        { id: jobApplicationWithoutIntermediaryId, intermediaryKind: null },
      ]),
    )
  })

  it("rejects every call made with another user's entity ids and modifies nothing", async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    await createJobApplicationOrFail(owner.client, owner.userId, {
      intermediaryName: 'Agence X',
      contactName: 'Jean Dupont',
      endClientName: 'Banque Z',
    })
    await createJobApplicationOrFail(intruder.client, intruder.userId, { endClientName: 'Groupe pirate' })
    const ownerEndClientId = await findEndClientIdByName(owner, 'Banque Z')
    const intruderEndClientId = await findEndClientIdByName(intruder, 'Groupe pirate')
    const ownerContactId = await findContactIdByName(owner, 'Jean Dupont')
    const { data: ownerIntermediary } = await owner.client.from('intermediaries').select('id').single()

    await expect(assignEndClientParent(intruder.client, intruder.userId, ownerEndClientId, intruderEndClientId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Client final introuvable',
    })
    await expect(assignEndClientParent(intruder.client, intruder.userId, intruderEndClientId, ownerEndClientId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Client final introuvable',
    })
    await expect(findContactDetails(intruder.client, intruder.userId, ownerContactId)).resolves.toEqual({
      ok: false,
      errorMessage: 'Contact introuvable',
    })
    await expect(
      saveContactDetails(intruder.client, intruder.userId, ownerContactId, {
        fullName: 'Piraté',
        phone: null,
        email: null,
        linkedinUrl: null,
      }),
    ).resolves.toEqual({ ok: false, errorMessage: 'Contact introuvable' })
    await expect(saveIntermediaryKind(intruder.client, intruder.userId, ownerIntermediary!.id, 'other')).resolves.toEqual({
      ok: false,
      errorMessage: 'Intermédiaire introuvable',
    })
    await expect(
      searchEntitySuggestions(intruder.client, intruder.userId, { entityKind: 'end_client', query: 'banque' }),
    ).resolves.toEqual([])

    const { data: ownerEndClient } = await owner.client.from('end_clients').select('parent_end_client_id').single()
    expect(ownerEndClient).toEqual({ parent_end_client_id: null })
    await expect(findContactDetails(owner.client, owner.userId, ownerContactId)).resolves.toMatchObject({
      ok: true,
      data: { fullName: 'Jean Dupont' },
    })
    const { data: ownerIntermediaryAfterAttempt } = await owner.client.from('intermediaries').select('kind').single()
    expect(ownerIntermediaryAfterAttempt).toEqual({ kind: null })
  })
})
