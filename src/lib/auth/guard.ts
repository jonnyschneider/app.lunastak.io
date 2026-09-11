/**
 * The API's one access gate. Every `route.ts` under `src/app/api/` imports this or is on the public
 * allowlist in `src/app/api/__tests__/route-auth.test.ts` — that test fails otherwise.
 *
 * Why one module: before this, ~17 routes hand-rolled "who is this request?" and a dozen more had
 * no check at all (a conversation id was enough to read it, append to it, or spend LLM calls on
 * it). Scattered copies are how one of them quietly stops validating; a single gate plus a test
 * that enumerates the routes is how that can't come back.
 *
 * Each `require*` returns the requester (and the resource, when it is one) or a ready response:
 *
 *   const auth = await requireConversationAccess(id)
 *   if (isDenied(auth)) return auth
 *   const { requester, conversation } = auth
 *
 * Which guard for which route, the options, and the don'ts: ARCHITECTURE.md → "API Access — every
 * route goes through the guard". The demo-access decisions behind `read`: its Security & Access Control.
 *
 * Access levels:
 *   write (default) — the requester owns it.
 *   read            — the requester owns it, OR it belongs to an `isDemo` project.
 * `write` is the default so that honouring demos has to be asked for: a write that honoured
 * `isDemo` would let any guest mutate a showcase project.
 *
 * A resource the requester can't see is a 404, never a 403 — don't confirm an id exists.
 */

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getRequester, type Requester } from './current-user'

export type Access = 'read' | 'write'

export interface GuardOptions {
  access?: Access
  /** false → signed-up users only (a guest cookie is a 401). Default true. */
  guests?: boolean
  /** An already-resolved requester — skips a second session/cookie lookup. */
  as?: Requester
}

export interface ProjectGuardOptions extends GuardOptions {
  /**
   * true → an archived project is not found (404), even to its owner. It's a filter in the
   * query, not a check afterwards, so an archived project answers exactly like one that doesn't
   * exist. Only projects have a status; the other guards don't take this, so it can't be passed
   * to one and silently ignored.
   */
  active?: boolean
}

export function isDenied(result: unknown): result is NextResponse {
  return result instanceof Response
}

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const notFound = (what: string) => NextResponse.json({ error: `${what} not found` }, { status: 404 })

/** Which projects `userId` may see at this access level. The one place `isDemo` is honoured. */
function projectVisibleTo(userId: string, access: Access): Prisma.ProjectWhereInput {
  return access === 'read' ? { OR: [{ userId }, { isDemo: true }] } : { userId }
}

export async function requireUser(
  opts: Pick<GuardOptions, 'guests' | 'as'> = {},
): Promise<Requester | NextResponse> {
  const requester = opts.as ?? (await getRequester())
  if (!requester) return unauthorized()
  if (opts.guests === false && requester.isGuest) return unauthorized()
  return requester
}

export async function requireProjectAccess(projectId: string, opts: ProjectGuardOptions = {}) {
  const requester = await requireUser(opts)
  if (isDenied(requester)) return requester
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(opts.active ? { status: 'active' } : {}),
      ...projectVisibleTo(requester.userId, opts.access ?? 'write'),
    },
    select: { id: true, userId: true, isDemo: true, status: true },
  })
  if (!project) return notFound('Project')
  return { requester, project }
}

/**
 * Either link proves ownership: `transferGuestToUser` rewrites both `conversation.userId` and
 * `project.userId`, but a transferred guest's empty project can be deleted and `projectId` is
 * nullable — so neither link alone is always present.
 */
export async function requireConversationAccess(conversationId: string, opts: GuardOptions = {}) {
  const requester = await requireUser(opts)
  if (isDenied(requester)) return requester
  const { userId } = requester
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ userId }, { project: projectVisibleTo(userId, opts.access ?? 'write') }],
    },
    select: { id: true, userId: true, projectId: true },
  })
  if (!conversation) return notFound('Conversation')
  return { requester, conversation }
}

/** A trace (a generated strategy) is owned directly, through its conversation, or through its project. */
export async function requireTraceAccess(traceId: string, opts: GuardOptions = {}) {
  const requester = await requireUser(opts)
  if (isDenied(requester)) return requester
  const { userId } = requester
  const trace = await prisma.trace.findFirst({
    where: {
      id: traceId,
      OR: [{ userId }, { conversation: { userId } }, { project: projectVisibleTo(userId, opts.access ?? 'write') }],
    },
    select: { id: true, conversationId: true, projectId: true },
  })
  if (!trace) return notFound('Strategy')
  return { requester, trace }
}

export async function requireDocumentAccess(documentId: string, opts: GuardOptions = {}) {
  const requester = await requireUser(opts)
  if (isDenied(requester)) return requester
  const document = await prisma.document.findFirst({
    where: { id: documentId, project: projectVisibleTo(requester.userId, opts.access ?? 'write') },
    select: { id: true, projectId: true },
  })
  if (!document) return notFound('Document')
  return { requester, document }
}

/**
 * A client-supplied deepDiveId is only trusted if it belongs to the project it's being attached
 * in. Without this, a known deep-dive id lets anyone plant a document in someone else's deep dive.
 */
export async function deepDiveInProject(deepDiveId: string, projectId: string): Promise<boolean> {
  return (await prisma.deepDive.count({ where: { id: deepDiveId, projectId } })) > 0
}
