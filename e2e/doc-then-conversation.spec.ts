import { test, expect } from '@playwright/test'
import path from 'path'
import {
  seedAuthUser,
  waitForPipelineComplete,
  fetchProjectData,
} from './helpers'

test.describe('Flow 2: Document Upload → Conversation → Strategy', () => {
  test('uploading a doc first does not break conversation or lose doc fragments', async ({ page, context }) => {
    test.setTimeout(180_000)
    const baseURL = test.info().project.use.baseURL!

    // 1. Seed authenticated user (doc upload requires auth)
    await seedAuthUser(context, baseURL)

    // Navigate — new auth user gets an empty project
    await page.goto('/')
    await page.waitForURL(/\/project\//)
    const projectId = page.url().split('/project/')[1]?.split(/[/?#]/)[0]
    expect(projectId).toBeTruthy()

    // 2. FirstTimeEmptyState should render
    await expect(page.locator('textarea[placeholder*="Start anywhere"]')).toBeVisible({ timeout: 10_000 })

    // 3. Upload document via the upload button
    await page.locator('button:has-text("Upload a document")').click()

    // Dialog opens — select file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-strategy-doc.txt'))

    // Click Upload button in dialog (scoped to dialog to avoid sidebar/inline matches)
    await page.locator('[role="dialog"] button:has-text("Upload")').click()

    // Wait for upload to complete — dialog closes and dashboard renders with doc fragments
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 60_000 })
      .catch(() => {
        // Dialog may already be gone
      })

    // Dashboard should now show fragment count from document
    await expect(page.locator('text=/\\d+ insight/i')).toBeVisible({ timeout: 30_000 })

    // Verify doc fragments via API
    const preConvoData = await fetchProjectData(context, baseURL, projectId)
    const docFragmentCount = preConvoData.stats.fragmentCount
    expect(docFragmentCount).toBeGreaterThan(0) // Doc should have produced fragments

    // 4. Start a new conversation from sidebar
    await page.locator('a:has-text("New Chat"), button:has-text("New Chat")').first().click()

    // Wait for chat interface textarea to appear
    const chatInput = page.locator('textarea').first()
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    // 5. Send messages in the chat panel
    const loadingIndicator = page.locator('svg.animate-\\[pulse_3s_ease-in-out_infinite\\]')

    await chatInput.fill(
      "I'm building a SaaS tool that helps small restaurants manage their menu and pricing. We've got 5 paying customers and want to grow to 50 this quarter."
    )
    await page.locator('button:has-text("Send")').click()
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 10_000 }).catch(() => {})
    await expect(loadingIndicator).toHaveCount(0, { timeout: 60_000 })

    await chatInput.fill(
      "Our main challenge is that restaurant owners are time-poor and skeptical of new tech. Word of mouth from existing customers is our best channel."
    )
    await page.locator('button:has-text("Send")').click()
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 10_000 }).catch(() => {})
    await expect(loadingIndicator).toHaveCount(0, { timeout: 60_000 })

    // 6. Navigate back to dashboard and trigger generation
    await page.locator('text="Your Thinking"').click()
    await expect(page.locator('button:has-text("Create strategy")')).toBeVisible({ timeout: 10_000 })
    await page.locator('button:has-text("Create strategy")').click()

    // 7. Wait for pipeline to complete
    await waitForPipelineComplete(page)

    // 8. Verify ALL fragments included (doc + conversation)
    const postData = await fetchProjectData(context, baseURL, projectId)
    expect(postData.stats.fragmentCount).toBeGreaterThan(docFragmentCount)
    expect(postData.stats.strategyIsStale).toBe(false)

    // Dashboard shows correct counts
    await expect(page.locator('text=/\\d+ insight/i')).toBeVisible()

    // Strategy page renders
    await page.locator('a:has-text("View")').click()
    await page.waitForURL(/\/strategy\//)
    await expect(page.locator('text="Vision"')).toBeVisible({ timeout: 10_000 })
  })
})
