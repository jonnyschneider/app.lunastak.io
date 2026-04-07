'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

/**
 * Legacy route. Fragments now live in EvidenceSheet on the project page.
 * Redirect to /project/[id]?evidence=1 (preserving any ?dimension=… filter)
 * so external links (book, marketing site, old bookmarks) still work.
 */
export default function FragmentsRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string

  useEffect(() => {
    const url = new URL(`/project/${projectId}`, window.location.origin)
    url.searchParams.set('evidence', '1')
    const dimension = searchParams.get('dimension')
    if (dimension) url.searchParams.set('dimension', dimension)
    router.replace(url.pathname + url.search)
  }, [projectId, router, searchParams])

  return null
}
