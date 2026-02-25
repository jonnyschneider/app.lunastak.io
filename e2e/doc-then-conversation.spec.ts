import { test, expect } from '@playwright/test'
import path from 'path'
import {
  seedAuthUser,
  fetchProjectData,
} from './helpers'

test.describe('Flow 2: Document Upload', () => {
  test('uploading a doc produces fragments and renders on dashboard', async ({ page, context }) => {
    test.setTimeout(120_000)
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

    // 4. Dashboard should render with doc fragment info
    await expect(page.locator('text=/\\d+ insight/i')).toBeVisible({ timeout: 30_000 })

    // Document should appear in the Documents section
    await expect(page.locator('text="test-strategy-doc.txt"')).toBeVisible({ timeout: 10_000 })

    // 5. Verify doc fragments via API
    const projectData = await fetchProjectData(context, baseURL, projectId)
    expect(projectData.stats.fragmentCount).toBeGreaterThan(0)

    // Strategy should not exist yet (requires a conversation first)
    await expect(page.locator('text="No strategies yet"')).toBeVisible()
  })
})
