/**
 * One registry for the demo projects.
 *
 * The four ids were hardcoded in `Launchpad.tsx` and again as `DEMO_META` in `page.tsx`, in a
 * different order, and the project switcher was about to become a third copy. The ordering
 * divergence is the tell: nothing was keeping the two in agreement, so nothing did.
 */
import { DEMO_PROJECTS, DEMO_META, DEMO_EPISODE_URLS, isDemoProjectId } from '../demos'

describe('demo registry', () => {
  it('carries all four demos', () => {
    expect(DEMO_PROJECTS.map((d) => d.name)).toEqual(['Ferrari', 'Nike', 'Costco', 'TSMC'])
  })

  it('leads with Ferrari — decided 2026-09-08, "Ferrari leads the demos"', () => {
    expect(DEMO_PROJECTS[0].name).toBe('Ferrari')
  })

  it('derives DEMO_META from the same rows, so the two can never disagree', () => {
    for (const demo of DEMO_PROJECTS) {
      expect(DEMO_META[demo.id]).toEqual({ name: demo.name, logo: demo.logo })
    }
    expect(Object.keys(DEMO_META)).toHaveLength(DEMO_PROJECTS.length)
  })

  it('gives every demo a mark and an episode to cite', () => {
    for (const demo of DEMO_PROJECTS) {
      expect(demo.logo).toMatch(/^\/logo-.+\.svg$/)
      expect(demo.episodeUrl).toMatch(/^https:\/\/www\.acquired\.fm\/episodes\//)
    }
  })

  it('recognises a demo id and rejects anything else', () => {
    expect(isDemoProjectId(DEMO_PROJECTS[0].id)).toBe(true)
    expect(isDemoProjectId('cmnotademo')).toBe(false)
  })

  it('derives the episode-url lookup too — it was a fourth inline copy, mid-JSX', () => {
    for (const demo of DEMO_PROJECTS) {
      expect(DEMO_EPISODE_URLS[demo.id]).toBe(demo.episodeUrl)
    }
    expect(Object.keys(DEMO_EPISODE_URLS)).toHaveLength(DEMO_PROJECTS.length)
  })
})
