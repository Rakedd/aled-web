import { useState } from 'react'
import { GENERIC_ACTION_ERROR_MESSAGE, type ActionResult } from '@/domain/action-result'
import type { SnoozeDurationInDays } from '@/domain/alert-snoozes'
import { isJobApplicationTodoAlert, type CvOutdatedTodoAlert, type JobApplicationTodoAlert, type TodoAlert } from '@/domain/todo-alerts'
import { getTodoAlertKey } from './format-todo-alert'
import type { TodoBannerControllerParameters } from './interfaces'

export const useController = ({
  initialAlerts,
  snoozeAlert,
  confirmCvStillGood,
  changeJobApplicationStatus,
  onDataChanged,
}: TodoBannerControllerParameters) => {
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<string[]>([])
  const [closedJobApplicationIds, setClosedJobApplicationIds] = useState<string[]>([])
  const [pendingAlertKeys, setPendingAlertKeys] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const alerts = initialAlerts.filter(
    (alert) =>
      !dismissedAlertKeys.includes(getTodoAlertKey(alert)) &&
      !(isJobApplicationTodoAlert(alert) && closedJobApplicationIds.includes(alert.jobApplicationId)),
  )

  const isAlertPending = (alert: TodoAlert): boolean => pendingAlertKeys.includes(getTodoAlertKey(alert))

  const runServerAction = async (
    alertKey: string,
    serverAction: () => Promise<ActionResult<null>>,
  ): Promise<string | null> => {
    setPendingAlertKeys((currentKeys) => [...currentKeys, alertKey])
    try {
      const actionResult = await serverAction()
      return actionResult.ok ? null : actionResult.errorMessage
    } catch {
      return GENERIC_ACTION_ERROR_MESSAGE
    } finally {
      setPendingAlertKeys((currentKeys) => currentKeys.filter((currentKey) => currentKey !== alertKey))
    }
  }

  const snooze = async (alert: JobApplicationTodoAlert, days: SnoozeDurationInDays) => {
    const alertKey = getTodoAlertKey(alert)
    setErrorMessage(null)
    setDismissedAlertKeys((currentKeys) => [...currentKeys, alertKey])
    const failureMessage = await runServerAction(alertKey, () => snoozeAlert(alert.jobApplicationId, alert.kind, days))
    if (failureMessage === null) {
      onDataChanged()
      return
    }
    setDismissedAlertKeys((currentKeys) => currentKeys.filter((currentKey) => currentKey !== alertKey))
    setErrorMessage(failureMessage)
  }

  const confirmStillGood = async (alert: CvOutdatedTodoAlert) => {
    const alertKey = getTodoAlertKey(alert)
    setErrorMessage(null)
    setDismissedAlertKeys((currentKeys) => [...currentKeys, alertKey])
    const failureMessage = await runServerAction(alertKey, () => confirmCvStillGood(alert.cvId))
    if (failureMessage === null) {
      onDataChanged()
      return
    }
    setDismissedAlertKeys((currentKeys) => currentKeys.filter((currentKey) => currentKey !== alertKey))
    setErrorMessage(failureMessage)
  }

  const closeAsNoNews = async (alert: JobApplicationTodoAlert) => {
    setErrorMessage(null)
    const failureMessage = await runServerAction(getTodoAlertKey(alert), () =>
      changeJobApplicationStatus(alert.jobApplicationId, 'no_news_abandoned'),
    )
    if (failureMessage !== null) {
      setErrorMessage(failureMessage)
      return
    }
    setClosedJobApplicationIds((currentIds) => [...currentIds, alert.jobApplicationId])
    onDataChanged()
  }

  return { alerts, errorMessage, isAlertPending, snooze, confirmStillGood, closeAsNoNews }
}
