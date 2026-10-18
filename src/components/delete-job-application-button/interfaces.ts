import type { ActionResult } from '@/domain/action-result'

export type DeleteJobApplication = (jobApplicationId: string) => Promise<ActionResult<null>>

export type DeleteJobApplicationButtonControllerParameters = {
  jobApplicationId: string
  deleteJobApplication: DeleteJobApplication
  navigate: (route: string) => void
}

export type DeleteJobApplicationButtonProps = Omit<DeleteJobApplicationButtonControllerParameters, 'navigate'>
