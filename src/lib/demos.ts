/**
 * The demo projects, in one place.
 *
 * They are real `Project` rows with `isDemo: true`, reached by ordinary `/project/<id>` links — which
 * is why the project switcher can carry them (navigation design §5) and why they never needed a
 * surface of their own.
 *
 * ⚠ THERE WERE THREE COPIES OF THIS, and the switcher was about to be a fourth. `Launchpad.tsx` held
 * the full rows, `page.tsx` held a `DEMO_META` lookup with the same four ids in a different order,
 * and `screen-map.md` §7 had already flagged "hardcoded in three places" before the switcher was
 * proposed. `DEMO_META` is now derived, so the two shapes cannot drift apart.
 *
 * Ferrari leads — decided 2026-09-08, "Ferrari leads the demos".
 */

export interface DemoProject {
  id: string
  name: string
  logo: string
  /** Launchpad cards only — the switcher renders a label, not a mark. */
  logoHeight: string
  description: string
  episodeUrl: string
}

export const DEMO_PROJECTS: DemoProject[] = [
  { id: 'cmnxrkvuv0094ow1betk3sjzr', name: 'Ferrari', logo: '/logo-ferrari.svg', logoHeight: 'h-14', description: 'Cornered resource and brand power', episodeUrl: 'https://www.acquired.fm/episodes/ferrari' },
  { id: 'cmn8anetr5kwlmbmq', name: 'Nike', logo: '/logo-nike.svg', logoHeight: 'h-14', description: 'Scale economies and brand power', episodeUrl: 'https://www.acquired.fm/episodes/nike' },
  { id: 'cmn8an6ivpa0xoehj', name: 'Costco', logo: '/logo-costco.svg', logoHeight: 'h-14', description: 'Scale economies shared', episodeUrl: 'https://www.acquired.fm/episodes/costco' },
  { id: 'cmn8anbaapaww1709', name: 'TSMC', logo: '/logo-tsmc.svg', logoHeight: 'h-14', description: 'Process power and counter-positioning', episodeUrl: 'https://www.acquired.fm/episodes/tsmc' },
]

/** The lookup the project page wants: id → { name, logo }. Derived, never hand-maintained. */
export const DEMO_META: Record<string, { name: string; logo: string }> = Object.fromEntries(
  DEMO_PROJECTS.map((d) => [d.id, { name: d.name, logo: d.logo }])
)

export function isDemoProjectId(id: string): boolean {
  return id in DEMO_META
}

/**
 * id → the Acquired episode the demo's transcript came from. Powers the "Generated from Acquired
 * podcast transcript" attribution that replaces the version stamp on a demo stack.
 *
 * This was a FOURTH inline copy of the four ids, in the middle of the masthead JSX.
 */
export const DEMO_EPISODE_URLS: Record<string, string> = Object.fromEntries(
  DEMO_PROJECTS.map((d) => [d.id, d.episodeUrl])
)
