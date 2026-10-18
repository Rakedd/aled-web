import { useEffect, useState } from 'react'
import { JOB_APPLICATIONS_ROUTE } from '@/domain/routes'
import type { JobApplicationDeletedNoticeControllerParameters } from './interfaces'

export const useController = ({
  isJobApplicationDeleted,
  replaceRoute,
}: JobApplicationDeletedNoticeControllerParameters) => {
  const [isNoticeVisible] = useState(isJobApplicationDeleted)

  useEffect(() => {
    if (isJobApplicationDeleted) replaceRoute(JOB_APPLICATIONS_ROUTE, { scroll: false })
  }, [isJobApplicationDeleted, replaceRoute])

  return { isNoticeVisible }
}
