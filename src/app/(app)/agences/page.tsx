import { redirect } from 'next/navigation'
import { INTERMEDIARIES_LIST_ROUTE } from '@/domain/routes'

const IntermediariesRedirectPage = () => redirect(INTERMEDIARIES_LIST_ROUTE)

export default IntermediariesRedirectPage
