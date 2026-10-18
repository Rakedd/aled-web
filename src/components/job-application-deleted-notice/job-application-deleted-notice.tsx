'use client'

import { useRouter } from 'next/navigation'
import { useController } from './controller'
import type { JobApplicationDeletedNoticeProps } from './interfaces'

const JOB_APPLICATION_DELETED_MESSAGE = 'Candidature supprimée'

export const JobApplicationDeletedNotice = ({ isJobApplicationDeleted }: JobApplicationDeletedNoticeProps) => {
  const router = useRouter()
  const { isNoticeVisible } = useController({ isJobApplicationDeleted, replaceRoute: router.replace })

  if (!isNoticeVisible) return null

  return (
    <p role="status" className="text-sm text-muted-foreground">
      {JOB_APPLICATION_DELETED_MESSAGE}
    </p>
  )
}
