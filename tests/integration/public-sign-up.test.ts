import { randomUUID } from 'node:crypto'
import { createAnonymousTestClient, createServiceRoleTestClient } from './create-test-user'

const MAILPIT_MESSAGES_URL = 'http://127.0.0.1:54324/api/v1/messages'

interface MailpitMessageSummary {
  ID: string
  Subject: string
  To: { Address: string }[]
}

const buildTestEmail = () => `sign-up-${randomUUID()}@test.local`

const findProfileByUserId = async (userId: string) => {
  const { data, error } = await createServiceRoleTestClient()
    .from('profiles')
    .select('first_name, professional_status, terms_accepted_at')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

const createUserWithMetadata = async (userMetadata: Record<string, unknown>) => {
  const { data, error } = await createServiceRoleTestClient().auth.admin.createUser({
    email: buildTestEmail(),
    password: randomUUID(),
    email_confirm: true,
    user_metadata: userMetadata,
  })
  if (error) throw error
  return data.user
}

const USERS_PER_PAGE = 1000

const countUsersWithEmail = async (email: string): Promise<number> => {
  let matchingUsersCount = 0
  for (let page = 1; ; page += 1) {
    const { data, error } = await createServiceRoleTestClient().auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
    if (error) throw error
    matchingUsersCount += data.users.filter((user) => user.email === email).length
    if (matchingUsersCount >= 2 || data.users.length < USERS_PER_PAGE) return matchingUsersCount
  }
}

const readMailpitMessageBody = async (recipientEmail: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listResponse = await fetch(MAILPIT_MESSAGES_URL)
    const { messages } = (await listResponse.json()) as { messages: MailpitMessageSummary[] }
    const message = messages.find((candidate) => candidate.To.some((recipient) => recipient.Address === recipientEmail))
    if (message) {
      const messageResponse = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)
      const fullMessage = (await messageResponse.json()) as { Subject: string; HTML: string }
      return fullMessage
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No email received for ${recipientEmail}`)
}

describe('public sign-up', () => {
  it('creates the profile with the first name, the professional status and the terms acceptance of a password sign-up', async () => {
    const { data, error } = await createAnonymousTestClient().auth.signUp({
      email: buildTestEmail(),
      password: 'a-strong-password',
      options: { data: { first_name: '  Ada ', professional_status: 'freelance', terms_accepted: 'true' } },
    })
    expect(error).toBeNull()

    const profile = await findProfileByUserId(data.user!.id)
    expect(profile.first_name).toBe('Ada')
    expect(profile.professional_status).toBe('freelance')
    expect(profile.terms_accepted_at).not.toBeNull()
  })

  it.each([
    ['given_name', { given_name: 'Grace' }, 'Grace'],
    ['full_name', { full_name: 'Grace Hopper' }, 'Grace'],
    ['name', { name: 'Grace Hopper' }, 'Grace'],
    ['nothing', {}, null],
    ['a 300 characters first name', { first_name: 'a'.repeat(300) }, 'a'.repeat(100)],
  ])('derives the first name from OAuth metadata: %s', async (_label, userMetadata, expectedFirstName) => {
    const user = await createUserWithMetadata(userMetadata)
    const profile = await findProfileByUserId(user.id)
    expect(profile.first_name).toBe(expectedFirstName)
    expect(profile.terms_accepted_at).toBeNull()
  })

  it('ignores an unknown professional status', async () => {
    const user = await createUserWithMetadata({ professional_status: 'astronaut' })
    const profile = await findProfileByUserId(user.id)
    expect(profile.professional_status).toBeNull()
  })

  it('answers a second sign-up with the same address without creating another user', async () => {
    const email = buildTestEmail()
    const anonymousClient = createAnonymousTestClient()
    const firstSignUp = await anonymousClient.auth.signUp({ email, password: 'a-strong-password' })
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const secondSignUp = await anonymousClient.auth.signUp({ email, password: 'another-password' })
    expect(firstSignUp.error).toBeNull()
    expect(secondSignUp.error).toBeNull()

    await expect(countUsersWithEmail(email)).resolves.toBe(1)
  })

  it('answers a sign-up with the address of a confirmed user like any other without creating another user', async () => {
    const email = buildTestEmail()
    const { error: creationError } = await createServiceRoleTestClient().auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    })
    expect(creationError).toBeNull()

    const { error: signUpError } = await createAnonymousTestClient().auth.signUp({
      email,
      password: 'a-strong-password',
    })
    expect(signUpError).toBeNull()
    await expect(countUsersWithEmail(email)).resolves.toBe(1)
  })

  it('sends the confirmation email in French', async () => {
    const email = buildTestEmail()
    const { error } = await createAnonymousTestClient().auth.signUp({ email, password: 'a-strong-password' })
    expect(error).toBeNull()

    const message = await readMailpitMessageBody(email)
    expect(message.Subject).toBe('Active ton compte Aled')
    expect(message.HTML).toContain('/auth/confirm?token_hash=')
    expect(message.HTML).toContain('type=email')
  })
})
