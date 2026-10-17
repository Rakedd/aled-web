import { useState } from 'react'
import type { ActionResult } from '@/domain/action-result'
import type { SnoozeDurationInDays } from '@/domain/alert-snoozes'
import type { TodoAlert } from '@/domain/todo-alerts'
import { getTodoAlertKey } from './format-todo-alert'
import type { TodoBannerControllerParameters } from './interfaces'

export const TODO_BANNER_GENERIC_ERROR_MESSAGE = 'Une erreur est survenue, réessaie.'

export const useController = ({
  initialAlerts,
  snoozeAlert,
  changeJobApplicationStatus,
}: TodoBannerControllerParameters) => {
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<string[]>([])
  const [closedJobApplicationIds, setClosedJobApplicationIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const alerts = initialAlerts.filter(
    (alert) =>
      !dismissedAlertKeys.includes(getTodoAlertKey(alert)) && !closedJobApplicationIds.includes(alert.jobApplicationId),
  )

  const runServerAction = async (serverAction: () => Promise<ActionResult<null>>): Promise<string | null> => {
    try {
      const actionResult = await serverAction()
      return actionResult.ok ? null : actionResult.errorMessage
    } catch {
      return TODO_BANNER_GENERIC_ERROR_MESSAGE
    }
  }

  const snooze = async (alert: TodoAlert, days: SnoozeDurationInDays) => {
    const alertKey = getTodoAlertKey(alert)
    setErrorMessage(null)
    setDismissedAlertKeys((currentKeys) => [...currentKeys, alertKey])
    const failureMessage = await runServerAction(() => snoozeAlert(alert.jobApplicationId, alert.kind, days))
    if (failureMessage === null) return
    setDismissedAlertKeys((currentKeys) => currentKeys.filter((currentKey) => currentKey !== alertKey))
    setErrorMessage(failureMessage)
  }

  const closeAsNoNews = async (alert: TodoAlert) => {
    setErrorMessage(null)
    const failureMessage = await runServerAction(() =>
      changeJobApplicationStatus(alert.jobApplicationId, 'no_news_abandoned'),
    )
    if (failureMessage !== null) {
      setErrorMessage(failureMessage)
      return
    }
    setClosedJobApplicationIds((currentIds) => [...currentIds, alert.jobApplicationId])
  }

  return { alerts, errorMessage, snooze, closeAsNoNews }
}
