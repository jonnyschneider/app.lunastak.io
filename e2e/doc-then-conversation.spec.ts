import { test, expect } from '@playwright/test'
import path from 'path'
import {
  seedAuthUser,
  sendMessage,
  triggerGeneration,
  waitForPipelineComplete,
  fetchProjectData,
} from './helpers'

test.describe('Flow 2: Document Upload → Conversation → Strategy', () => {
  test('uploading a doc first does not break initial conversation or lose doc fragments', async ({ page, context }) => {
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

    // Click Upload button in dialog
    await page.locator('button:has-text("Upload")').click()

    // Wait for document processing to complete (dialog closes or shows success)
    await expect(page.locator('text=/complete|processed/i')).toBeVisible({ timeout: 60_000 })
      .catch(() => {
        // Dialog may auto-close on success
      })

    // Close dialog if still open
    const closeButton = page.locator('[role="dialog"] button:has-text("Close")')
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
    }

    // 4. FirstTimeEmptyState should STILL render — InlineChat still available
    await expect(page.locator('textarea[placeholder*="Start anywhere"]')).toBeVisible({ timeout: 10_000 })

    // Fetch pre-conversation fragment count (from document only)
    const preConvoData = await fetchProjectData(context, baseURL, projectId)
    const docFragmentCount = preConvoData.stats.fragmentCount
    expect(docFragmentCount).toBeGreaterThan(0) // Doc should have produced fragments

    // 5. Start conversation, send 2-3 messages
    await sendMessage(page,
      "I'm building a SaaS tool that helps small restaurants manage their menu and pricing. We've got 5 paying customers and want to grow to 50 this quarter."
    )
    await sendMessage(page,
      "Our main challenge is that restaurant owners are time-poor and skeptical of new tech. Word of mouth from existing customers is our best channel."
    )

    // 6. Trigger generation
    await triggerGeneration(page)
    await waitForPipelineComplete(page)

    // 7. Verify ALL fragments included (doc + conversation)
    const postData = await fetchProjectData(context, baseURL, projectId)
    expect(postData.stats.fragmentCount).toBeGreaterThan(docFragmentCount)
    expect(postData.stats.strategyIsStale).toBe(false)
    expect(postData.stats.fragmentsSinceSummary).toBe(0)

    // Dashboard shows correct counts
    await expect(page.locator('text=/\\d+ insight/i')).toBeVisible()

    // Strategy page renders
    await page.locator('a:has-text("View")').click()
    await page.waitForURL(/\/strategy\//)
    await expect(page.locator('text="Vision"')).toBeVisible({ timeout: 10_000 })
  })
})
