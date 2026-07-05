import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

/**
 * Public share links — one rolling link per project.
 *
 * The token IS the security mechanism ("anyone with the link can view"):
 * 24 random bytes → 32-char base64url string → 192 bits of entropy.
 * Unguessable at any realistic scale; no password required.
 *
 * Lifecycle: minted on first share-enable, persists across on/off toggles
 * (Google Docs behaviour — re-enabling doesn't break previously sent links).
 * `shareEnabled` is the access switch; turning it off kills the link instantly.
 */

const SHARE_TOKEN_LENGTH = 32

export function mintShareToken(): string {
  return randomBytes(24).toString('base64url')
}

/** Cheap pre-DB sanity check so malformed input never becomes a query. */
export function isValidShareTokenFormat(token: string): boolean {
  return (
    typeof token === 'string' &&
    token.length === SHARE_TOKEN_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(token)
  )
}

export interface ShareState {
  enabled: boolean
  shareToken: string | null
  sharedAt: Date | null
}

/** Owner-side: read current share state for a project. */
export async function getShareState(projectId: string): Promise<ShareState | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { shareEnabled: true, shareToken: true, sharedAt: true },
  })
  if (!project) return null
  return {
    enabled: project.shareEnabled,
    shareToken: project.shareToken,
    sharedAt: project.sharedAt,
  }
}

/**
 * Owner-side: toggle sharing. Mints the token on first enable; the token
 * survives disable so a re-enabled link keeps working for prior recipients.
 * Caller is responsible for ownership checks.
 */
export async function setProjectSharing(
  projectId: string,
  enabled: boolean
): Promise<ShareState> {
  const current = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { shareToken: true },
  })

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      shareEnabled: enabled,
      ...(enabled && !current.shareToken ? { shareToken: mintShareToken() } : {}),
      ...(enabled ? { sharedAt: new Date() } : {}),
    },
    select: { shareEnabled: true, shareToken: true, sharedAt: true },
  })

  return {
    enabled: updated.shareEnabled,
    shareToken: updated.shareToken,
    sharedAt: updated.sharedAt,
  }
}

/**
 * Recipient-side: resolve a share token to its project, ONLY if sharing is
 * live. This is the single public read path — everything the share page
 * shows must come from this query.
 */
export async function getSharedProjectByToken(token: string) {
  if (!isValidShareTokenFormat(token)) return null

  return prisma.project.findFirst({
    where: {
      shareToken: token,
      shareEnabled: true,
      status: 'active',
    },
    select: {
      id: true,
      userId: true,
      name: true,
      knowledgeSummary: true,
    },
  })
}
