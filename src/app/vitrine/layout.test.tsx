import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'
import LandingLayout, { buildLandingMetadata } from './layout'

jest.mock('@vercel/analytics/next', () => ({ Analytics: () => <div data-testid="analytics" /> }))

const ORIGINAL_ENVIRONMENT = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENVIRONMENT, APP_ORIGIN: 'https://app.aled.work' }
  delete process.env.LANDING_HOSTNAMES
})

afterAll(() => {
  process.env = ORIGINAL_ENVIRONMENT
})

describe('buildLandingMetadata', () => {
  it('makes the landing indexable under its canonical domain', () => {
    process.env.LANDING_HOSTNAMES = 'aled.work'

    const landingMetadata = buildLandingMetadata()

    expect(String(landingMetadata.metadataBase)).toBe('https://aled.work/')
    expect(landingMetadata.robots).toEqual({ index: true, follow: true })
  })

  it('has no canonical domain when none is configured', () => {
    expect(buildLandingMetadata().metadataBase).toBeUndefined()
  })
})

describe('LandingLayout', () => {
  it('measures the audience of the landing', () => {
    render(<LandingLayout><p>contenu</p></LandingLayout>)

    expect(screen.getByTestId('analytics')).toBeInTheDocument()
  })

  it('sends the sign in link to the app', () => {
    render(<LandingLayout><p>contenu</p></LandingLayout>)

    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', 'https://app.aled.work/login')
  })

  it('keeps the audience measurement out of the app', () => {
    const appLayoutSources = ['../(app)/layout.tsx', '../layout.tsx'].map((relativePath) =>
      fs.readFileSync(path.join(__dirname, relativePath), 'utf8'),
    )

    appLayoutSources.forEach((layoutSource) => expect(layoutSource).not.toContain('@vercel/analytics'))
  })
})
