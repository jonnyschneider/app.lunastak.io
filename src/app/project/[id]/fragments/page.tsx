'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { knowledgeHref, parseKnowledgeFilter } from '@/lib/navigation/knowledge-filter'

/**
 * Legacy route. Fragments live in the Knowledge Summary on the project page now — expand it and
 * the ground truths are there, filtered by the coverage grid.
 *
 * Redirects to the knowledgebase, keeping a `?dimension=` filter if the link carried one. Keeping
 * the same URL means the book, the marketing site and old bookmarks did not have to know any of
 * that changed.
 *
 * Built with `knowledgeHref` rather than by hand: this route used to emit `?evidence=1&dimension=`
 * itself, and the dimension half was read by nothing for a day after `FragmentExplorer` went. An
 * empty project still lands on the cold start — `ProjectClient` re-applies that rule whatever the
 * mode says.
 */
export default function FragmentsRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string

  useEffect(() => {
    router.replace(knowledgeHref(projectId, parseKnowledgeFilter(searchParams)))
  }, [projectId, router, searchParams])

  return null
}
