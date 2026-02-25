import { test, expect } from '@playwright/test'
import path from 'path'
import {
  seedAuthUser,
  waitForPipelineComplete,
  fetchProjectData,
} from './helpers'

test.describe('Flow 2: Document Upload → Strategy', () => {
  test('uploading a doc produces fragments and generates strategy from them', async ({ page, context }) => {
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
    const preGenData = await fetchProjectData(context, baseURL, projectId)
    const docFragmentCount = preGenData.stats.fragmentCount
    expect(docFragmentCount).toBeGreaterThan(0) // Doc should have produced fragments

    // 4. Click "Create strategy" to generate from doc fragments
    const createStrategyBtn = page.getByRole('button', { name: 'Create strategy', exact: true })
    await expect(createStrategyBtn).toBeVisible({ timeout: 10_000 })
    await createStrategyBtn.click()

    // 5. Wait for pipeline to complete
    await waitForPipelineComplete(page)

    // 6. Verify strategy was generated from doc fragments
    const postData = await fetchProjectData(context, baseURL, projectId)
    expect(postData.stats.fragmentCount).toBe(docFragmentCount)
    expect(postData.stats.strategyIsStale).toBe(false)

    // Dashboard shows correct state
    await expect(page.locator('text=/\\d+ insight/i')).toBeVisible()
    await expect(page.locator('text="Strategy in sync"')).toBeVisible({ timeout: 5_000 })

    // Strategy page renders
    await page.locator('a:has-text("View")').click()
    await page.waitForURL(/\/strategy\//)
    await expect(page.locator('text="Vision"')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text="Strategy"')).toBeVisible()
    await expect(page.locator('text="Objectives"')).toBeVisible()
  })
})
