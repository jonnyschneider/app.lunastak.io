/**
 * The knowledgebase's addressable filters — what `?mode=knowledge` can be asked to open on.
 *
 * ⚠ ONE PARSER AND ONE BUILDER, so a link and the page that reads it cannot disagree. Anything that
 * links INTO a filtered knowledgebase (guidance, a legacy redirect, an email) builds the URL with
 * `knowledgeHref`; `ProjectClient` reads it with `parseKnowledgeFilter`. Before this, `?dimension=`
 * was emitted by two places and read by none for a day (`FragmentExplorer`'s deletion took the only
 * reader with it), and nothing noticed because nothing tied the writers to the reader.
 *
 * Two filters, and at most one applies:
 *
 *   `filter=changed`   the ground truths added or discarded since the stack was built
 *   `dimension=<d>`    the ground truths tagged to one Tier-1 dimension
 *
 * `changed` wins when both arrive. The panel already enforces "one filter at a time" (picking a
 * dimension clears changed-only — two filters at once answers neither question), and the diff is the
 * more specific instruction. Junk values are ignored, never trusted: an unknown dimension opens the
 * unfiltered list rather than an empty one.
 */

import { TIER_1_DIMENSIONS, type Tier1Dimension } from '@/lib/constants/dimensions'

export type KnowledgeFilter =
  | { kind: 'changed' }
  | { kind: 'dimension'; dimension: Tier1Dimension }

interface ParamReader {
  get(name: string): string | null
}

export function isTier1Dimension(value: unknown): value is Tier1Dimension {
  return typeof value === 'string' && (TIER_1_DIMENSIONS as readonly string[]).includes(value)
}

export function parseKnowledgeFilter(params: ParamReader): KnowledgeFilter | null {
  if (params.get('filter') === 'changed') return { kind: 'changed' }
  const dimension = params.get('dimension')
  if (isTier1Dimension(dimension)) return { kind: 'dimension', dimension }
  return null
}

/** The address of a project's knowledgebase, optionally opened on a filter. */
export function knowledgeHref(projectId: string, filter?: KnowledgeFilter | null): string {
  const query = new URLSearchParams({ mode: 'knowledge' })
  if (filter?.kind === 'changed') query.set('filter', 'changed')
  if (filter?.kind === 'dimension') query.set('dimension', filter.dimension)
  return `/project/${encodeURIComponent(projectId)}?${query}`
}
