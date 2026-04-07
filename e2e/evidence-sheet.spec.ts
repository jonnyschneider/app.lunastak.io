import { test, expect } from '@playwright/test'

test.describe('Evidence sheet & nav persistence', () => {
  test('top tabs remain visible when Evidence sheet is open', async ({ page }) => {
    test.setTimeout(60_000)

    // Land on a demo project that's known to have fragments
    await page.goto('/project/cmn8anetr5kwlmbmq') // Nike demo
    await page.waitForLoadState('networkidle')

    // Switch to Knowledgebase tab
    await page.getByRole('button', { name: /Knowledgebase/i }).click()

    // Locate the Evidence panel and click "Open Evidence"
    const openBtn = page.getByRole('button', { name: /Open Evidence/i })
    await expect(openBtn).toBeVisible()
    await openBtn.click()

    // Sheet should be open (look for Evidence sheet title)
    await expect(page.getByRole('dialog').getByText(/^Evidence$/)).toBeVisible()

    // Critically: top-level tabs are STILL visible while sheet is open
    await expect(page.getByRole('button', { name: /Decision Stack/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Knowledgebase/i })).toBeVisible()

    // URL has ?evidence=1
    await expect(page).toHaveURL(/[?&]evidence=1/)

    // Close sheet (Escape)
    await page.keyboard.press('Escape')
    await expect(page).not.toHaveURL(/[?&]evidence=1/)
  })

  test('legacy /fragments route redirects and opens Evidence sheet', async ({ page }) => {
    await page.goto('/project/cmn8anetr5kwlmbmq/fragments?dimension=CUSTOMER_MARKET')
    await page.waitForURL(/\?evidence=1.*dimension=CUSTOMER_MARKET/)
    await expect(page.getByRole('dialog').getByText(/^Evidence$/)).toBeVisible()
    // Tabs visible
    await expect(page.getByRole('button', { name: /Decision Stack/i })).toBeVisible()
  })
})
