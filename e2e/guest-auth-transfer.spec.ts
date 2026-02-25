import { test, expect } from '@playwright/test'
import {
  sendMessage,
  triggerGeneration,
  waitForPipelineComplete,
  getGuestCookie,
  seedAuthUser,
  fetchProjectData,
} from './helpers'

test.describe('Flow 3: Guest → Auth Transfer', () => {
  test('guest project transfers to authenticated user with all data intact', async ({ page, context }) => {
    test.setTimeout(180_000)
    const baseURL = test.info().project.use.baseURL!

    // 1. Complete Flow 1 as guest
    await page.goto('/')
    await page.waitForURL(/\/project\//)
    const projectId = page.url().split('/project/')[1]?.split(/[/?#]/)[0]
    expect(projectId).toBeTruthy()

    const guestUserId = await getGuestCookie(context, baseURL)
    expect(guestUserId).toBeTruthy()

    // Have a conversation and generate strategy
    await expect(page.locator('textarea[placeholder*="Start anywhere"]')).toBeVisible({ timeout: 10_000 })
    await sendMessage(page,
      "I'm building a SaaS tool that helps small restaurants manage their menu and pricing."
    )
    await sendMessage(page,
      "Word of mouth is our best growth channel. We want to reach 50 customers this quarter."
    )
    await triggerGeneration(page)
    await waitForPipelineComplete(page)

    // Snapshot pre-transfer state
    const preTransferData = await fetchProjectData(context, baseURL, projectId)
    const preFragmentCount = preTransferData.stats.fragmentCount
    expect(preFragmentCount).toBeGreaterThan(0)

    // 2. Seed authenticated user and transfer guest data
    const { userId } = await seedAuthUser(context, baseURL, { guestUserId: guestUserId! })

    // 3. Navigate as authenticated user
    await page.goto('/')
    await page.waitForURL(/\/project\//)

    // 4. Project should now belong to authenticated user with data intact
    const postTransferData = await fetchProjectData(context, baseURL, projectId)
    expect(postTransferData.stats.fragmentCount).toBe(preFragmentCount)
    expect(postTransferData.stats.strategyIsStale).toBe(false)

    // Strategy card should still work
    await expect(page.locator('text="Your Decision Stack"')).toBeVisible()
    await expect(page.locator('a:has-text("View")')).toBeVisible()

    // 5. Guest cookie should be cleared (seed-user doesn't clear it,
    // but we can verify the project is now owned by the auth user)
    const projectsResponse = await context.request.get(`${baseURL}/api/projects`)
    expect(projectsResponse.ok()).toBeTruthy()
    const projects = await projectsResponse.json()
    const ownedProject = projects.find?.((p: { id: string }) => p.id === projectId)
    expect(ownedProject).toBeTruthy()
  })
})
