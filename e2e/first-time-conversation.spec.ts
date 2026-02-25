import { test, expect } from '@playwright/test'
import {
  sendMessage,
  triggerGeneration,
  waitForPipelineComplete,
  getGuestCookie,
  fetchProjectData,
} from './helpers'

test.describe('Flow 1: Guest → Conversation → Strategy', () => {
  test('fresh guest can have a conversation and generate their first strategy', async ({ page, context }) => {
    const baseURL = page.url() ? new URL(page.url()).origin : test.info().project.use.baseURL!

    // 1. Navigate as fresh guest — should redirect to /project/{id}
    await page.goto('/')
    await page.waitForURL(/\/project\//)
    const projectId = page.url().split('/project/')[1]?.split(/[/?#]/)[0]
    expect(projectId).toBeTruthy()

    // Verify guest cookie was set
    const guestUserId = await getGuestCookie(context, baseURL)
    expect(guestUserId).toBeTruthy()

    // 2. FirstTimeEmptyState should render with InlineChat
    await expect(page.locator('textarea[placeholder*="Start anywhere"]')).toBeVisible({ timeout: 10_000 })

    // 3. Send 2-3 strategy-rich messages
    await sendMessage(page,
      "I'm building a SaaS tool that helps small restaurants manage their menu and pricing. We've got 5 paying customers and want to grow to 50 this quarter."
    )
    await sendMessage(page,
      "Our main challenge is that restaurant owners are time-poor and skeptical of new tech. Word of mouth from existing customers is our best channel."
    )

    // 4. Click Finish → confirm generation
    await triggerGeneration(page)

    // 5. Wait for pipeline to complete
    await waitForPipelineComplete(page)

    // 6. Assert dashboard state
    // Strategy card should have a View link (not empty placeholder)
    await expect(page.locator('text="Your Decision Stack"')).toBeVisible()
    await expect(page.locator('a:has-text("View")')).toBeVisible()

    // KnowledgebaseHeader should show insights and "up to date"
    await expect(page.locator('text=/\\d+ insight/i')).toBeVisible()

    // HUM-81 regression: should NOT show "Create Strategy" button
    await expect(page.locator('button:has-text("Create strategy")')).not.toBeVisible()

    // Fragment countdown should say "up to date" (not "N more 'til next auto-update")
    // Expand the knowledge panel first to see the countdown
    await page.locator('text="Knowledgebase"').click()
    await expect(page.locator('text="up to date"')).toBeVisible({ timeout: 5_000 })

    // 7. Navigate to strategy page and verify content renders
    await page.locator('a:has-text("View")').click()
    await page.waitForURL(/\/strategy\//)
    // Vision, strategy, and at least one objective should render
    await expect(page.locator('text="Vision"')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text="Strategy"')).toBeVisible()
    await expect(page.locator('text="Objectives"')).toBeVisible()

    // 8. Verify server state via API
    const projectData = await fetchProjectData(context, baseURL, projectId)
    expect(projectData.stats.fragmentCount).toBeGreaterThan(0)
    expect(projectData.stats.strategyIsStale).toBe(false)
    expect(projectData.stats.fragmentsSinceSummary).toBe(0)
  })
})
