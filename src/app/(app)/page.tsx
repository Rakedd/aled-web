import { redirect } from 'next/navigation'
import { JOB_APPLICATIONS_ROUTE } from '@/domain/routes'

const HomePage = () => redirect(JOB_APPLICATIONS_ROUTE)

export default HomePage
