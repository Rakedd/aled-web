import { render, screen } from '@testing-library/react'
import LandingPage from './page'

const ORIGINAL_ENVIRONMENT = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENVIRONMENT, APP_ORIGIN: 'https://app.aled.work' }
})

afterAll(() => {
  process.env = ORIGINAL_ENVIRONMENT
})

describe('LandingPage', () => {
  it('sends both calls to action to the sign up page', () => {
    render(<LandingPage />)

    expect(screen.getByRole('link', { name: 'Je reste sur mon canapé' })).toHaveAttribute(
      'href',
      'https://app.aled.work/inscription',
    )
    expect(screen.getByRole('link', { name: 'Aled, sauve-moi' })).toHaveAttribute(
      'href',
      'https://app.aled.work/inscription',
    )
  })

  it('has a single page title', () => {
    render(<LandingPage />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('never says freelance', () => {
    render(<LandingPage />)

    expect(document.body.textContent).not.toMatch(/freelance/i)
  })
})
