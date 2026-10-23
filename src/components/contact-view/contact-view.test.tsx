import { render, screen } from '@testing-library/react'
import { buildContactDetails } from '@/test-fixtures/job-application-overview'
import { ContactView } from './contact-view'

const readValueOf = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling

describe('ContactView', () => {
  it('shows the phone as a tel: link and the e-mail as a mailto: link', () => {
    render(
      <ContactView
        contactName="Jeanne Martin"
        contactDetails={buildContactDetails({ phone: '+33 6 12 34 56 78' })}
        loadErrorMessage={null}
        contactId={null}
      />,
    )
    expect(readValueOf('Nom')).toHaveTextContent('Jeanne Martin')
    expect(screen.getByRole('link', { name: '+33 6 12 34 56 78' })).toHaveAttribute('href', 'tel:+33612345678')
    expect(screen.getByRole('link', { name: 'jeanne@example.com' })).toHaveAttribute('href', 'mailto:jeanne@example.com')
    const linkedinLink = screen.getByRole('link', { name: 'LinkedIn' })
    expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/jeanne')
    expect(linkedinLink).toHaveAttribute('target', '_blank')
    expect(linkedinLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows a dash for every missing detail', () => {
    render(
      <ContactView
        contactName="Jeanne Martin"
        contactDetails={buildContactDetails({ phone: null, email: null, linkedinUrl: null })}
        loadErrorMessage={null}
        contactId={null}
      />,
    )
    expect(readValueOf('Téléphone')).toHaveTextContent('—')
    expect(readValueOf('E-mail')).toHaveTextContent('—')
    expect(readValueOf('LinkedIn')).toHaveTextContent('—')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows a dash instead of a link for a refused LinkedIn url', () => {
    render(
      <ContactView
        contactName="Jeanne Martin"
        contactDetails={buildContactDetails({ linkedinUrl: 'javascript:alert(1)' })}
        loadErrorMessage={null}
        contactId={null}
      />,
    )
    expect(readValueOf('LinkedIn')).toHaveTextContent('—')
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument()
  })

  it('shows a dash for the name when the application has no contact', () => {
    render(<ContactView contactName={null} contactDetails={null} loadErrorMessage={null} contactId={null} />)
    expect(readValueOf('Nom')).toHaveTextContent('—')
    expect(readValueOf('Téléphone')).toHaveTextContent('—')
  })

  it('tells when the contact details could not be loaded', () => {
    render(<ContactView contactName="Jeanne Martin" contactDetails={null} loadErrorMessage="Contact introuvable" contactId={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Contact introuvable')
  })

  it('links to the contact page', () => {
    render(<ContactView contactName="Jeanne Martin" contactDetails={null} loadErrorMessage={null} contactId="contact-1" />)
    expect(screen.getByRole('link', { name: 'Voir la fiche du contact' })).toHaveAttribute('href', '/contacts/contact-1')
  })

  it('does not link to a contact page without a contact', () => {
    render(<ContactView contactName={null} contactDetails={null} loadErrorMessage={null} contactId={null} />)
    expect(screen.queryByRole('link', { name: 'Voir la fiche du contact' })).not.toBeInTheDocument()
  })
})
