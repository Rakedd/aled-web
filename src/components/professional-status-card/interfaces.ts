import type { ActionResult } from '@/domain/action-result'
import type { ProfessionalStatus } from '@/domain/sign-up'

export type SaveProfessionalStatus = (professionalStatus: ProfessionalStatus) => Promise<ActionResult<null>>

export type ProfessionalStatusCardControllerParameters = {
  saveProfessionalStatus: SaveProfessionalStatus
  onAnswered: () => void
}

export type ProfessionalStatusCardProps = {
  saveProfessionalStatus: SaveProfessionalStatus
  answeredFocusTargetId: string
}
