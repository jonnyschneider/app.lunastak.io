'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

/**
 * Legacy route. Fragments live in the Knowledge Summary on the project page now — expand it and
 * the ground truths are there, filtered by the coverage grid.
 *
 * Still redirects to /project/[id]?evidence=1. That param no longer opens a sheet (there isn't
 * one); the project page reads it as "take me to what was extracted", lands on the Knowledgebase
 * and clears it. Keeping the same URL means the book, the marketing site and old bookmarks did
 * not have to know any of that changed.
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
