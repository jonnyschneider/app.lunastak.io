'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Loader2 } from 'lucide-react'

/**
 * Redirect page - fetches user's projects and redirects to the first one
 * This handles the case when someone navigates to /project without an ID
 */
export default function ProjectRedirect() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    // Don't redirect to signin - guests can access projects via cookie
    // Fetch projects and redirect to the first one
    const redirectToProject = async () => {
      try {
        const response = await fetch('/api/projects')
        if (response.ok) {
          const data = await response.json()
          if (data.projects && data.projects.length > 0) {
            router.replace(`/project/${data.projects[0].id}`)
          }
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      }
    }

    redirectToProject()
  }, [status, router])

  return (
    <AppLayout>
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  )
}
