import { LandingClosingSection } from '@/components/landing-closing-section'
import { LandingHero } from '@/components/landing-hero'
import { LandingJourneySection } from '@/components/landing-journey-section'
import { LandingPainSection } from '@/components/landing-pain-section'
import { SIGN_UP_PATHNAME } from '@/domain/landing-routing'
import { buildAppUrl } from '@/lib/landing/landing-environment'

const LandingPage = () => {
  const signUpUrl = buildAppUrl(SIGN_UP_PATHNAME)

  return (
    <>
      <LandingHero signUpUrl={signUpUrl} />
      <LandingPainSection />
      <LandingJourneySection />
      <LandingClosingSection signUpUrl={signUpUrl} />
    </>
  )
}

export default LandingPage
