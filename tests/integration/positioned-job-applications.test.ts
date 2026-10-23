import { randomUUID } from 'node:crypto'
import { listPositionedJobApplications } from '@/server/repositories/job-applications-repository'
import { createSignedInTestClient } from './create-test-user'
import { createJobApplicationOrFail } from './job-application-fixtures'

jest.mock('server-only', () => ({}))

const createTestUser = () => createSignedInTestClient(`positioned-${randomUUID()}@test.local`)

describe('listPositionedJobApplications', () => {
  it('returns only the positioning fields of the own job applications, newest first', async () => {
    const owner = await createTestUser()
    const stranger = await createTestUser()
    const olderId = await createJobApplicationOrFail(owner.client, owner.userId, {
      title: 'Older',
      endClientName: 'Cardif',
      endClientParentName: 'BNP Paribas',
      intermediaryName: 'Hays',
      appliedOn: new Date('2026-10-01T10:00:00Z'),
    })
    const newerId = await createJobApplicationOrFail(owner.client, owner.userId, {
      title: 'Newer',
      appliedOn: new Date('2026-10-12T10:00:00Z'),
    })
    await createJobApplicationOrFail(stranger.client, stranger.userId, { title: 'Not mine' })

    const positionedJobApplications = await listPositionedJobApplications(owner.client, owner.userId)

    expect(positionedJobApplications).toEqual([
      {
        id: newerId,
        title: 'Newer',
        endClientName: null,
        endClientParentName: null,
        intermediaryName: null,
        appliedOn: new Date('2026-10-12T00:00:00+02:00'),
      },
      {
        id: olderId,
        title: 'Older',
        endClientName: 'Cardif',
        endClientParentName: 'BNP Paribas',
        intermediaryName: 'Hays',
        appliedOn: new Date('2026-10-01T00:00:00+02:00'),
      },
    ])
    expect(Object.keys(positionedJobApplications[0]).sort()).toEqual(
      ['appliedOn', 'endClientName', 'endClientParentName', 'id', 'intermediaryName', 'title'],
    )
  })
})
