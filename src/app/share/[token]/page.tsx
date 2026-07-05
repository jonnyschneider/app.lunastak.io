import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSharedProjectByToken } from '@/lib/share'
import { getStrategyStatements } from '@/lib/decision-stack'
import { logStatsigEvent } from '@/lib/statsig'
import { InlineMarkdown } from '@/components/InlineMarkdown'
import StrategyDisplay from '@/components/StrategyDisplay'

/**
 * Public read-only Decision Stack view — "anyone with the link".
 *
 * Deliberately NOT the demo middleware-rewrite pattern: this page is the
 * single public read path. Everything shown here comes from one server-side
 * lookup; no client API calls, so no other route needs to know about tokens.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const project = await getSharedProjectByToken(token)
  if (!project) notFound()

  const strategy = await getStrategyStatements(project.id)
  if (!strategy) notFound()

  // Attribute the view to the owner so share funnels are queryable per user.
  // Awaited (not fire-and-forget): background work is dropped on Vercel once
  // the response completes.
  await logStatsigEvent(project.userId, 'share_page_view', undefined, {
    projectId: project.id,
  }).catch(() => {})

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lunastak-logo-mulberry.svg" alt="Lunastak" className="h-9 w-auto" />
          </Link>
          <span className="rounded-full border border-input px-3 py-1 text-xs text-muted-foreground">
            Shared read-only view
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">{project.name}</h1>

        {project.knowledgeSummary && (
          <section className="mt-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Context
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <InlineMarkdown text={project.knowledgeSummary} />
            </p>
          </section>
        )}

        <div className="mt-8">
          <StrategyDisplay
            strategy={strategy}
            conversationId=""
            traceId=""
            projectId={project.id}
            readOnly
            staticContent
          />
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            This Decision Stack was built with Lunastak — an AI strategy coach for founders.
          </p>
          <Link
            href="/?utm_source=share_page&utm_medium=cta"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Build your own Decision Stack
          </Link>
        </div>
      </footer>
    </div>
  )
}
