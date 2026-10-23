'use client'

import { useEffect, useState } from 'react'
import { HOME_ROUTE } from '@/domain/routes'
import { SIGN_UP_MESSAGES } from '@/domain/sign-up'
import type { PasswordUpdatedBannerProps } from './interfaces'

const LIVE_REGION_ANNOUNCEMENT_DELAY_MILLISECONDS = 100

export const PasswordUpdatedBanner = ({ isPasswordUpdated }: PasswordUpdatedBannerProps) => {
  const [isMessageShown, setIsMessageShown] = useState(false)

  useEffect(() => {
    if (!isPasswordUpdated) return
    window.history.replaceState(null, '', HOME_ROUTE)
    const revealTimeoutId = setTimeout(() => setIsMessageShown(true), LIVE_REGION_ANNOUNCEMENT_DELAY_MILLISECONDS)
    return () => clearTimeout(revealTimeoutId)
  }, [isPasswordUpdated])

  return (
    <div role="status">
      {isMessageShown && (
        <p className="mb-5 rounded-2xl bg-card px-6 py-4 text-sm font-semibold text-ink">{SIGN_UP_MESSAGES.passwordUpdated}</p>
      )}
    </div>
  )
}
