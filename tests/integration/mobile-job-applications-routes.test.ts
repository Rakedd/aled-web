import { randomUUID } from 'node:crypto'
import { POST as createJobApplicationRoute } from '@/app/api/mobile/job-applications/route'
import { POST as extractJobPostingRoute } from '@/app/api/mobile/job-postings/extract/route'
import { MOBILE_JOB_APPLICATION_SOURCE } from '@/domain/mobile-job-application-request'
import { formatParisCalendarDate } from '@/domain/paris-time'
import { createAnthropicClient } from '@/server/ai/create-anthropic-client'
import { createFakeAnthropicClientReturning, emptyExtraction } from '@/server/ai/testing/fake-anthropic-client'
import { encryptApiKey } from '@/server/crypto/api-key-encryption'
import { findJobApplicationOverview } from '@/server/repositories/job-applications-repository'
import { storeEncryptedAnthropicApiKey } from '@/server/repositories/profile-repository'
import { createSignedInTestClient } from './create-test-user'

jest.mock('server-only', () => ({}))
jest.mock('@/server/ai/create-anthropic-client', () => ({ createAnthropicClient: jest.fn() }))

const ENCRYPTION_SECRET = Buffer.alloc(32, 7).toString('base64')
const POSTING_URL = 'https://www.linkedin.com/jobs/view/4012345678/'

const createTestUser = async ({ withApiKey }: { withApiKey: boolean }) => {
  const user = await createSignedInTestClient(`mobile-job-applications-${randomUUID()}@test.local`)
  const { data } = await user.client.auth.getSession()
  if (!data.session) throw new Error('Missing session for the test user')
  if (withApiKey) {
    const encryptedApiKey = encryptApiKey('sk-ant-fake-key', ENCRYPTION_SECRET)
    await storeEncryptedAnthropicApiKey(user.client, user.userId, { encryptedApiKey, apiKeyLastFour: 'fake' })
  }
  return { ...user, accessToken: data.session.access_token }
}

const callRoute = (
  route: (request: Request) => Promise<Response>,
  path: string,
  accessToken: string,
  body: unknown,
) =>
  route(
    new Request(`http://localhost:3000/api/mobile${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )

describe('mobile job applications routes', () => {
  beforeAll(() => {
    process.env.API_KEY_ENCRYPTION_SECRET = ENCRYPTION_SECRET
  })

  beforeEach(() => {
    jest.mocked(createAnthropicClient).mockReturnValue(
      createFakeAnthropicClientReturning({
        ...emptyExtraction,
        title: 'Lead dev React',
        intermediaryName: 'Talentis',
        stack: [{ name: 'React', category: 'framework' }],
      }),
    )
  })

  it('creates the shared job application with the share defaults, visible to its owner only', async () => {
    const owner = await createTestUser({ withApiKey: false })
    const otherUser = await createTestUser({ withApiKey: false })

    const response = await callRoute(createJobApplicationRoute, '/job-applications', owner.accessToken, {
      title: 'Lead dev React',
      endClientName: 'Banque Alpha',
      intermediaryName: 'Talentis',
      contactName: null,
      postedDailyRate: 650,
      location: 'Lyon',
      remotePolicy: '2 jours sur site',
      postingUrl: POSTING_URL,
      postingRawText: 'Mission React à Lyon',
      stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
    })

    expect(response.status).toBe(200)
    const { jobApplicationId } = await response.json()
    const overview = await findJobApplicationOverview(owner.client, owner.userId, jobApplicationId)
    if (!overview.ok) throw new Error(overview.errorMessage)
    expect(overview.data).toMatchObject({
      userId: owner.userId,
      title: 'Lead dev React',
      source: MOBILE_JOB_APPLICATION_SOURCE,
      status: 'applied',
      postingUrl: POSTING_URL,
      postingRawText: 'Mission React à Lyon',
      postedDailyRate: 650,
      requestedDailyRate: null,
      location: 'Lyon',
      remotePolicy: '2 jours sur site',
      desiredStart: null,
      duration: null,
      notes: null,
      actualStartDate: null,
      intermediaryName: 'Talentis',
      endClientName: 'Banque Alpha',
      contactName: null,
      stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
      sentCv: null,
    })
    expect(formatParisCalendarDate(overview.data.appliedOn)).toBe(formatParisCalendarDate(new Date()))

    const { data: rowsSeenByOtherUser } = await otherUser.client
      .from('job_applications')
      .select('id')
      .eq('id', jobApplicationId)
    expect(rowsSeenByOtherUser).toEqual([])
    const overviewSeenByOtherUser = await findJobApplicationOverview(otherUser.client, otherUser.userId, jobApplicationId)
    expect(overviewSeenByOtherUser.ok).toBe(false)
  })

  it('creates the contact with its extracted details and links it to the intermediary, for its owner only', async () => {
    const owner = await createTestUser({ withApiKey: false })
    const otherUser = await createTestUser({ withApiKey: false })

    const response = await callRoute(createJobApplicationRoute, '/job-applications', owner.accessToken, {
      title: 'Lead dev React',
      intermediaryName: 'Talentis',
      contactName: 'Julie Martin',
      contactEmail: 'julie@talentis.fr',
      contactPhone: '06 12 34 56 78',
      desiredStart: 'ASAP',
      duration: '6 mois',
    })

    expect(response.status).toBe(200)
    const { jobApplicationId } = await response.json()
    const overview = await findJobApplicationOverview(owner.client, owner.userId, jobApplicationId)
    if (!overview.ok) throw new Error(overview.errorMessage)
    expect(overview.data).toMatchObject({
      contactName: 'Julie Martin',
      intermediaryName: 'Talentis',
      desiredStart: 'ASAP',
      duration: '6 mois',
    })
    const { data: contactRows } = await owner.client
      .from('contacts')
      .select('id, full_name, email, phone, intermediary_id')
      .eq('id', overview.data.contactId ?? '')
    expect(contactRows).toEqual([
      {
        id: overview.data.contactId,
        full_name: 'Julie Martin',
        email: 'julie@talentis.fr',
        phone: '06 12 34 56 78',
        intermediary_id: overview.data.intermediaryId,
      },
    ])
    expect(overview.data.intermediaryId).not.toBeNull()

    const { data: contactRowsSeenByOtherUser } = await otherUser.client
      .from('contacts')
      .select('id')
      .eq('id', overview.data.contactId ?? '')
    expect(contactRowsSeenByOtherUser).toEqual([])
    const { data: jobApplicationRowsSeenByOtherUser } = await otherUser.client
      .from('job_applications')
      .select('id')
      .eq('id', jobApplicationId)
    expect(jobApplicationRowsSeenByOtherUser).toEqual([])
  })

  it('refuses to create a job application without a title', async () => {
    const owner = await createTestUser({ withApiKey: false })
    const response = await callRoute(createJobApplicationRoute, '/job-applications', owner.accessToken, { title: '  ' })
    expect(response.status).toBe(400)
    const { data: ownerRows } = await owner.client.from('job_applications').select('id')
    expect(ownerRows).toEqual([])
  })

  it('extracts a pasted posting with the Claude key of the user', async () => {
    const owner = await createTestUser({ withApiKey: true })
    const response = await callRoute(extractJobPostingRoute, '/job-postings/extract', owner.accessToken, {
      rawText: 'Mission React chez Talentis',
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      title: 'Lead dev React',
      intermediaryName: 'Talentis',
      stack: [{ name: 'React', category: 'framework', origin: 'posting' }],
    })
    expect(createAnthropicClient).toHaveBeenCalledWith('sk-ant-fake-key')
  })

  it('answers missing_api_key to a user without a Claude key', async () => {
    const owner = await createTestUser({ withApiKey: false })
    const response = await callRoute(extractJobPostingRoute, '/job-postings/extract', owner.accessToken, {
      rawText: 'Mission React',
    })
    expect(response.status).toBe(422)
    expect((await response.json()).error.kind).toBe('missing_api_key')
  })

  it('answers 401 to a tampered token on both routes', async () => {
    const owner = await createTestUser({ withApiKey: false })
    const tokenParts = owner.accessToken.split('.')
    tokenParts[2] = 'x'.repeat(tokenParts[2].length)
    const tamperedToken = tokenParts.join('.')

    const extractionResponse = await callRoute(extractJobPostingRoute, '/job-postings/extract', tamperedToken, {
      rawText: 'Mission React',
    })
    const creationResponse = await callRoute(createJobApplicationRoute, '/job-applications', tamperedToken, {
      title: 'Lead dev React',
    })

    expect(extractionResponse.status).toBe(401)
    expect(creationResponse.status).toBe(401)
  })
})
