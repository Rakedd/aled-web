import { randomUUID } from 'node:crypto'
import { createAnonymousTestClient, createSignedInTestClient } from './create-test-user'

describe('data isolation between users', () => {
  it('prevents user B from reading or modifying user A data', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const { data: created } = await userA.client.from('job_applications').insert({ user_id: userA.userId, title: 'Mission A' }).select().single()

    const { data: readByB } = await userB.client.from('job_applications').select().eq('id', created!.id)
    expect(readByB).toEqual([])

    const { data: overviewReadByB } = await userB.client.from('job_applications_overview').select().eq('id', created!.id)
    expect(overviewReadByB).toEqual([])

    const { data: updatedByB } = await userB.client.from('job_applications').update({ title: 'Hacked' }).eq('id', created!.id).select()
    expect(updatedByB).toEqual([])

    const { data: deletedByB } = await userB.client.from('job_applications').delete().eq('id', created!.id).select()
    expect(deletedByB).toEqual([])

    const { error: insertForA } = await userB.client.from('job_applications').insert({ user_id: userA.userId, title: 'Forged' })
    expect(insertForA).not.toBeNull()

    const { error: uploadInA } = await userB.client.storage.from('job-specs').upload(`${userA.userId}/forged.pdf`, new Blob(['x'], { type: 'application/pdf' }))
    expect(uploadInA).not.toBeNull()

    const { error: uploadInOwnFolder } = await userB.client.storage.from('job-specs').upload(`${userB.userId}/own.pdf`, new Blob(['x'], { type: 'application/pdf' }))
    expect(uploadInOwnFolder).toBeNull()

    const { data: filesListedByA } = await userA.client.storage.from('job-specs').list(userB.userId)
    expect(filesListedByA).toEqual([])

    const { data: overviewReadByA } = await userA.client.from('job_applications_overview').select('title, has_job_spec').eq('id', created!.id)
    expect(overviewReadByA).toEqual([{ title: 'Mission A', has_job_spec: false }])
  })

  it('prevents user B from attaching own rows to user A job application', async () => {
    const userA = await createSignedInTestClient(`a-${randomUUID()}@test.local`)
    const userB = await createSignedInTestClient(`b-${randomUUID()}@test.local`)
    const { data: created } = await userA.client.from('job_applications').insert({ user_id: userA.userId, title: 'Mission A' }).select().single()

    const { error: forgedActivityError } = await userB.client.from('activity_log_entries').insert({ user_id: userB.userId, job_application_id: created!.id, kind: 'call', summary: 'Forged' })
    expect(forgedActivityError).not.toBeNull()

    const { error: forgedJobSpecError } = await userB.client.from('job_specs').insert({ user_id: userB.userId, job_application_id: created!.id, source_kind: 'text', raw_text: 'Forged' })
    expect(forgedJobSpecError).not.toBeNull()
  })

  it('creates a profile with a 7-day follow-up delay for a new user', async () => {
    const user = await createSignedInTestClient(`c-${randomUUID()}@test.local`)
    const { data } = await user.client.from('profiles').select('follow_up_delay_days').single()
    expect(data?.follow_up_delay_days).toBe(7)
  })

  it('keeps a contact and clears its intermediary when the intermediary is deleted', async () => {
    const user = await createSignedInTestClient(`d-${randomUUID()}@test.local`)
    const { data: intermediary } = await user.client.from('intermediaries').insert({ user_id: user.userId, name: 'Agence X', normalized_name: 'agence x' }).select().single()
    const { data: contact } = await user.client.from('contacts').insert({ user_id: user.userId, full_name: 'Jean Dupont', normalized_name: 'jean dupont', intermediary_id: intermediary!.id }).select().single()

    const { error: deletionError } = await user.client.from('intermediaries').delete().eq('id', intermediary!.id)
    expect(deletionError).toBeNull()

    const { data: contactAfterDeletion } = await user.client.from('contacts').select('intermediary_id').eq('id', contact!.id).single()
    expect(contactAfterDeletion).toEqual({ intermediary_id: null })
  })

  it('rejects a sign-up from an anonymous client because access is invite-only', async () => {
    const { error: signUpError } = await createAnonymousTestClient().auth.signUp({ email: `e-${randomUUID()}@test.local`, password: randomUUID() })
    expect(signUpError?.code).toBe('signup_disabled')
  })
})
