import { randomUUID } from 'node:crypto'
import { createJobApplicationOrFail } from './job-application-fixtures'
import { createServiceRoleTestClient, createSignedInTestClient } from './create-test-user'

const FREE_WORK_SOURCE = 'free-work'

const buildOpportunityRow = (externalId: string) => ({
  source: FREE_WORK_SOURCE,
  external_id: externalId,
  url: `https://www.free-work.com/fr/tech-it/missions/${externalId}`,
  title: 'Développeur React Senior',
  title_normalized: 'developpeur react senior',
  published_at: new Date().toISOString(),
})

const insertOpportunityOrFail = async (): Promise<string> => {
  const { data, error } = await createServiceRoleTestClient()
    .from('opportunities')
    .insert(buildOpportunityRow(randomUUID()))
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

describe('opportunities isolation', () => {
  it('lets every signed-in user read an opportunity inserted by the service role', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()

    const { data: readByA } = await userA.client.from('opportunities').select('id, skills').eq('id', opportunityId)
    const { data: readByB } = await userB.client.from('opportunities').select('id, skills').eq('id', opportunityId)

    expect(readByA).toEqual([{ id: opportunityId, skills: [] }])
    expect(readByB).toEqual([{ id: opportunityId, skills: [] }])
  })

  it('prevents a signed-in user from writing opportunities', async () => {
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()

    const { error: insertionError } = await userB.client.from('opportunities').insert(buildOpportunityRow(randomUUID()))
    expect(insertionError?.code).toBe('42501')

    const { error: updateError } = await userB.client.from('opportunities').update({ title: 'Hacked' }).eq('id', opportunityId)
    expect(updateError?.code).toBe('42501')

    const { error: deletionError } = await userB.client.from('opportunities').delete().eq('id', opportunityId)
    expect(deletionError?.code).toBe('42501')
  })

  it('rejects a second opportunity with the same source and external id', async () => {
    const externalId = randomUUID()
    const serviceRoleClient = createServiceRoleTestClient()
    await serviceRoleClient.from('opportunities').insert(buildOpportunityRow(externalId))

    const { error: duplicateError } = await serviceRoleClient.from('opportunities').insert(buildOpportunityRow(externalId))

    expect(duplicateError?.code).toBe('23505')
  })

  it('prevents user B from reading, modifying or deleting user A decision and filters', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()
    const { data: decisionOfA } = await userA.client
      .from('opportunity_decisions')
      .insert({ user_id: userA.userId, opportunity_id: opportunityId, decision: 'dismissed' })
      .select('id')
      .single()
    const { data: filtersOfA } = await userA.client
      .from('opportunity_filters')
      .insert({ user_id: userA.userId, include_keywords: ['react'], rate_floor_full_remote: 450 })
      .select('id')
      .single()

    const { data: decisionsReadByB } = await userB.client.from('opportunity_decisions').select().eq('id', decisionOfA!.id)
    const { data: decisionsUpdatedByB } = await userB.client.from('opportunity_decisions').update({ decision: 'applied' }).eq('id', decisionOfA!.id).select()
    const { data: decisionsDeletedByB } = await userB.client.from('opportunity_decisions').delete().eq('id', decisionOfA!.id).select()
    expect(decisionsReadByB).toEqual([])
    expect(decisionsUpdatedByB).toEqual([])
    expect(decisionsDeletedByB).toEqual([])

    const { data: filtersReadByB } = await userB.client.from('opportunity_filters').select().eq('id', filtersOfA!.id)
    const { data: filtersUpdatedByB } = await userB.client.from('opportunity_filters').update({ include_keywords: ['java'] }).eq('id', filtersOfA!.id).select()
    const { data: filtersDeletedByB } = await userB.client.from('opportunity_filters').delete().eq('id', filtersOfA!.id).select()
    expect(filtersReadByB).toEqual([])
    expect(filtersUpdatedByB).toEqual([])
    expect(filtersDeletedByB).toEqual([])

    const { error: forgedDecisionError } = await userB.client
      .from('opportunity_decisions')
      .insert({ user_id: userA.userId, opportunity_id: opportunityId, decision: 'applied' })
    expect(forgedDecisionError?.code).toBe('42501')

    const { data: decisionsReadByA } = await userA.client.from('opportunity_decisions').select('decision').eq('id', decisionOfA!.id)
    const { data: filtersReadByA } = await userA.client.from('opportunity_filters').select('include_keywords').eq('id', filtersOfA!.id)
    expect(decisionsReadByA).toEqual([{ decision: 'dismissed' }])
    expect(filtersReadByA).toEqual([{ include_keywords: ['react'] }])
  })

  it('rejects a decision of user B pointing to a job application of user A', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()
    const jobApplicationIdOfA = await createJobApplicationOrFail(userA.client, userA.userId)

    const { error: forgedLinkError } = await userB.client
      .from('opportunity_decisions')
      .insert({ user_id: userB.userId, opportunity_id: opportunityId, decision: 'applied', job_application_id: jobApplicationIdOfA })

    expect(forgedLinkError?.code).toBe('23503')
  })

  it('rejects a second decision of the same user on the same opportunity', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()
    await user.client.from('opportunity_decisions').insert({ user_id: user.userId, opportunity_id: opportunityId, decision: 'dismissed' })

    const { error: duplicateError } = await user.client
      .from('opportunity_decisions')
      .insert({ user_id: user.userId, opportunity_id: opportunityId, decision: 'applied' })

    expect(duplicateError?.code).toBe('23505')
  })

  it('rejects a negative rate floor', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)

    const { error: negativeFloorError } = await user.client
      .from('opportunity_filters')
      .insert({ user_id: user.userId, rate_floor_hybrid: -1 })

    expect(negativeFloorError?.code).toBe('23514')
  })

  it('keeps an applied decision and clears its job application when the application is deleted', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()
    const jobApplicationId = await createJobApplicationOrFail(user.client, user.userId)
    const { data: decision } = await user.client
      .from('opportunity_decisions')
      .insert({ user_id: user.userId, opportunity_id: opportunityId, decision: 'applied', job_application_id: jobApplicationId })
      .select('id')
      .single()

    await user.client.from('job_applications').delete().eq('id', jobApplicationId)

    const { data: decisionAfterDeletion } = await user.client.from('opportunity_decisions').select('decision, job_application_id').eq('id', decision!.id)
    expect(decisionAfterDeletion).toEqual([{ decision: 'applied', job_application_id: null }])
  })

  it('deletes the decisions of an opportunity when the opportunity is deleted', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const opportunityId = await insertOpportunityOrFail()
    await user.client.from('opportunity_decisions').insert({ user_id: user.userId, opportunity_id: opportunityId, decision: 'dismissed' })

    const serviceRoleClient = createServiceRoleTestClient()
    const { error: deletionError } = await serviceRoleClient.from('opportunities').delete().eq('id', opportunityId)
    expect(deletionError).toBeNull()

    const { data: remainingDecisions } = await serviceRoleClient.from('opportunity_decisions').select('id').eq('opportunity_id', opportunityId)
    expect(remainingDecisions).toEqual([])
  })

  it('stores when the user last viewed the opportunities on the profile', async () => {
    const user = await createSignedInTestClient(`a-${randomUUID()}@test.local`)

    const { data: profileBeforeVisit } = await user.client.from('profiles').select('opportunities_last_viewed_at').single()

    expect(profileBeforeVisit).toEqual({ opportunities_last_viewed_at: null })
  })
})
