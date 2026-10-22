import { render, screen } from '@testing-library/react'
import type { ProposedMission } from '@/domain/contacts'
import { ProposedMissionsList } from './proposed-missions-list'

const MISSION: ProposedMission = {
  jobApplicationId: 'application-1',
  title: 'Développeur React',
  appliedOn: new Date('2026-10-10T08:00:00Z'),
  endClientLabel: 'Société Générale',
  contactName: 'Jeanne Martin',
  status: 'cv_submitted',
  sentCvLabel: null,
  sentCvUploadedAt: null,
}

describe('ProposedMissionsList', () => {
  it('shows date, title, client, status and a link per mission', () => {
    render(<ProposedMissionsList proposedMissions={[MISSION]} showsContactName={false} />)
    expect(screen.getByRole('link', { name: 'Développeur React' })).toHaveAttribute('href', '/candidatures/application-1')
    expect(screen.getByText('10/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Société Générale')).toBeInTheDocument()
    expect(screen.getByText('CV positionné')).toBeInTheDocument()
    expect(screen.queryByText('Jeanne Martin')).not.toBeInTheDocument()
  })

  it('shows the contact name when asked to', () => {
    render(<ProposedMissionsList proposedMissions={[MISSION]} showsContactName />)
    expect(screen.getByText('Jeanne Martin')).toBeInTheDocument()
  })

  it('shows the cv sent for a mission', () => {
    const missionWithCv = { ...MISSION, sentCvLabel: 'CV DevOps', sentCvUploadedAt: new Date('2026-03-12T10:00:00Z') }
    render(<ProposedMissionsList proposedMissions={[missionWithCv]} showsContactName={false} />)
    expect(screen.getByText('CV : CV DevOps (12/03/2026)')).toBeInTheDocument()
  })

  it('shows no cv line when none was sent', () => {
    render(<ProposedMissionsList proposedMissions={[MISSION]} showsContactName={false} />)
    expect(screen.queryByText(/^CV :/)).not.toBeInTheDocument()
  })

  it('explains that there is no mission yet', () => {
    render(<ProposedMissionsList proposedMissions={[]} showsContactName={false} />)
    expect(screen.getByText("Aucune mission proposée pour l'instant.")).toBeInTheDocument()
  })
})
