import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense, use, useEffect, useState } from 'react'
import { HeaderView } from '@/components/header-view'
import type { JobApplicationOverview } from '@/domain/job-application'
import { buildJobApplicationOverview } from '@/test-fixtures/job-application-overview'
import { JobApplicationBlock } from './job-application-block'

const mockedRefresh = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockedRefresh }) }))

type ServerRender = { jobApplication: JobApplicationOverview; pendingServerResponse: Promise<void> | null }

type ApplyServerRender = (serverRender: ServerRender) => void

const ServerResponseGate = ({ pendingServerResponse }: { pendingServerResponse: Promise<void> | null }) => {
  if (pendingServerResponse !== null) use(pendingServerResponse)
  return null
}

const MissionDetailsPage = ({
  updateJobApplication,
  onServerRenderReady,
}: {
  updateJobApplication: jest.Mock
  onServerRenderReady: (applyServerRender: ApplyServerRender) => void
}) => {
  const [{ jobApplication, pendingServerResponse }, setServerRender] = useState<ServerRender>({
    jobApplication: buildJobApplicationOverview(),
    pendingServerResponse: null,
  })
  useEffect(() => onServerRenderReady(setServerRender), [onServerRenderReady])
  return (
    <>
      <ServerResponseGate pendingServerResponse={pendingServerResponse} />
      <JobApplicationBlock
        title="Infos mission"
        view={<p>Lieu : {jobApplication.location}</p>}
        form={{ kind: 'missionDetails', props: { jobApplication, updateJobApplication } }}
      />
    </>
  )
}

const renderMissionDetailsBlock = () => {
  const updateJobApplication = jest.fn().mockResolvedValue({ ok: true, data: null })
  let applyServerRender: ApplyServerRender = () => undefined
  render(
    <Suspense fallback={null}>
      <MissionDetailsPage
        updateJobApplication={updateJobApplication}
        onServerRenderReady={(serverRenderSetter) => (applyServerRender = serverRenderSetter)}
      />
    </Suspense>,
  )
  return { updateJobApplication, applyServerRender: (serverRender: ServerRender) => applyServerRender(serverRender) }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('JobApplicationBlock', () => {
  it('saves only the changed field and shows the refreshed value when it goes back to reading', async () => {
    const { updateJobApplication, applyServerRender } = renderMissionDetailsBlock()
    let finishServerResponse: () => void = () => undefined
    mockedRefresh.mockImplementation(() => {
      const pendingServerResponse = new Promise<void>((resolve) => (finishServerResponse = resolve))
      applyServerRender({ jobApplication: buildJobApplicationOverview({ location: 'Lyon' }), pendingServerResponse })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    const locationInput = screen.getByRole('textbox', { name: 'Lieu' })
    await userEvent.clear(locationInput)
    await userEvent.type(locationInput, 'Lyon')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateJobApplication).toHaveBeenCalledWith('application-1', { location: 'Lyon' })
    expect(mockedRefresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Lieu : Paris')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    await act(async () => finishServerResponse())
    expect(await screen.findByText('Lieu : Lyon')).toBeInTheDocument()
    expect(screen.queryByText('Lieu : Paris')).not.toBeInTheDocument()
  })

  it('goes back to reading without sending anything on « Annuler »', async () => {
    const { updateJobApplication } = renderMissionDetailsBlock()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    expect(screen.getByRole('textbox', { name: 'TJM annoncé (€)' })).toHaveFocus()
    await userEvent.type(screen.getByRole('textbox', { name: 'Lieu' }), ' centre')
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(updateJobApplication).not.toHaveBeenCalled()
    expect(mockedRefresh).not.toHaveBeenCalled()
    expect(screen.getByText('Lieu : Paris')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier Infos mission' })).toHaveFocus()
  })

  it('keeps the page title rendered beside the header block while the header is being edited', async () => {
    const jobApplication = buildJobApplicationOverview()
    render(
      <>
        <h1>{jobApplication.title}</h1>
        <JobApplicationBlock
          title="En-tête"
          isTitleHidden
          view={<HeaderView jobApplication={jobApplication} />}
          form={{
            kind: 'header',
            props: {
              jobApplication,
              updateJobApplication: jest.fn(),
              setEndClientParent: jest.fn(),
              updateIntermediaryKind: jest.fn(),
              searchEntities: jest.fn(),
            },
          }}
        />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Modifier En-tête' }))
    expect(screen.getByRole('textbox', { name: 'Titre de la mission *' })).toBeInTheDocument()
    expect(screen.queryByText(/Société Générale \(Groupe SG\) · via Free-Work/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Développeur React' })).toBeInTheDocument()
  })
})
