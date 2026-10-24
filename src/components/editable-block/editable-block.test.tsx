import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { EditableBlock } from './editable-block'

const renderEditableBlock = ({ heading }: { heading?: ReactNode } = {}) =>
  render(
    <EditableBlock
      title="Infos mission"
      heading={heading}
      view={<p>Lieu : Paris</p>}
      renderEdit={(close) => (
        <div>
          <label htmlFor="location">Lieu</label>
          <input id="location" defaultValue="Paris" />
          <button type="button" onClick={close}>
            Annuler
          </button>
        </div>
      )}
    />,
  )

describe('EditableBlock', () => {
  it('starts in reading mode with a titled section and an accessible pencil', () => {
    renderEditableBlock()
    expect(screen.getByRole('region', { name: 'Infos mission' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Infos mission' })).toBeInTheDocument()
    expect(screen.getByText('Lieu : Paris')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier Infos mission' })).toBeInTheDocument()
  })

  it('switches only this block to edit mode and focuses the first field', async () => {
    renderEditableBlock()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    expect(screen.queryByText('Lieu : Paris')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modifier Infos mission' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Lieu' })).toHaveFocus()
  })

  it('goes back to reading when the form closes and gives the focus back to the pencil', async () => {
    renderEditableBlock()
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByText('Lieu : Paris')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier Infos mission' })).toHaveFocus()
  })

  it('can replace the block title with a custom heading while keeping the section named', () => {
    renderEditableBlock({ heading: <h1>Développeur React</h1> })
    expect(screen.getByRole('region', { name: 'Infos mission' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Infos mission' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Développeur React' })).toBeInTheDocument()
    expect(screen.getByText('Lieu : Paris')).toBeInTheDocument()
  })

  it('puts the pencil on the same row as the custom heading', () => {
    renderEditableBlock({ heading: <h1>Développeur React</h1> })
    const pencilButton = screen.getByRole('button', { name: 'Modifier Infos mission' })
    const headingRow = screen.getByRole('heading', { level: 1 }).parentElement?.parentElement
    expect(headingRow).toContainElement(pencilButton)
    expect(headingRow).not.toContainElement(screen.getByText('Lieu : Paris'))
  })

  it('keeps the custom heading visible while editing', async () => {
    renderEditableBlock({ heading: <h1>Développeur React</h1> })
    await userEvent.click(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Développeur React' })).toBeInTheDocument()
    expect(screen.queryByText('Lieu : Paris')).not.toBeInTheDocument()
  })

  it('puts the pencil on the same row as the block title', () => {
    renderEditableBlock()
    const titleRow = screen.getByRole('heading', { name: 'Infos mission' }).parentElement
    expect(titleRow).toContainElement(screen.getByRole('button', { name: 'Modifier Infos mission' }))
    expect(titleRow).toHaveClass('items-center')
  })
})
