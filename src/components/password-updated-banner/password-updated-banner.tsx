'use client'

import { useEffect } from 'react'
import { HOME_ROUTE } from '@/domain/routes'
import { SIGN_UP_MESSAGES } from '@/domain/sign-up'

export const PasswordUpdatedBanner = () => {
  useEffect(() => {
    window.history.replaceState(null, '', HOME_ROUTE)
  }, [])

  return (
    <p role="status" className="rounded-2xl bg-card px-6 py-4 text-sm font-semibold text-ink">
      {SIGN_UP_MESSAGES.passwordUpdated}
    </p>
  )
}
