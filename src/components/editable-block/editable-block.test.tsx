import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableBlock } from './editable-block'

const renderEditableBlock = ({ isTitleHidden = false }: { isTitleHidden?: boolean } = {}) =>
  render(
    <EditableBlock
      title="Infos mission"
      isTitleHidden={isTitleHidden}
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

  it('can name the section without showing a heading', () => {
    renderEditableBlock({ isTitleHidden: true })
    expect(screen.getByRole('region', { name: 'Infos mission' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Infos mission' })).not.toBeInTheDocument()
  })
})
