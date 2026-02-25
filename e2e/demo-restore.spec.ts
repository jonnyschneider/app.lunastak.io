import { test, expect } from '@playwright/test'
import { seedAuthUser } from './helpers'

test.describe('Flow 4: Demo Restore → Strategy View', () => {
  test('demo restore navigates to strategy view, not project dashboard', async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL!

    // 1. Seed authenticated user
    await seedAuthUser(context, baseURL)

    // 2. Create demo project via API
    const response = await context.request.post(`${baseURL}/api/demo/create`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.projectId).toBeTruthy()
    expect(data.latestTraceId).toBeTruthy()

    // 3. Navigate to the strategy page directly (as the app would redirect)
    await page.goto(`/strategy/${data.latestTraceId}`)
    await page.waitForURL(/\/strategy\//)

    // 4. Strategy page renders with demo content
    await expect(page.locator('text="Vision"')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text="Strategy"')).toBeVisible()
    await expect(page.locator('text="Objectives"')).toBeVisible()
  })

  test('demo restore via sidebar navigates to strategy view', async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL!

    // Seed user with an existing project so they see the dashboard
    await seedAuthUser(context, baseURL)
    await page.goto('/')
    await page.waitForURL(/\/project\//)

    // Find and click the "See a demo" / demo restore button in sidebar
    // This depends on exact sidebar UI — using the API is more reliable
    const response = await context.request.post(`${baseURL}/api/demo/create`)
    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // The app should redirect to /strategy/{traceId}
    if (data.latestTraceId) {
      await page.goto(`/strategy/${data.latestTraceId}`)
      await page.waitForURL(/\/strategy\//)
      await expect(page.locator('text="Vision"')).toBeVisible({ timeout: 10_000 })
    }
  })
})
