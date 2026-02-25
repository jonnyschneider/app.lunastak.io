import { type Page, type BrowserContext, expect } from '@playwright/test'

/**
 * Seed an authenticated user via the test endpoint.
 * Sets the NextAuth session cookie on the browser context.
 */
export async function seedAuthUser(
  context: BrowserContext,
  baseURL: string,
  options?: { email?: string; guestUserId?: string }
): Promise<{ userId: string; email: string; sessionToken: string; transferred: boolean }> {
  const response = await context.request.post(`${baseURL}/api/test/seed-user`, {
    data: {
      email: options?.email,
      guestUserId: options?.guestUserId,
    },
  })
  expect(response.ok()).toBeTruthy()
  const data = await response.json()

  // Set NextAuth session cookie (secure prefix for HTTPS preview deploys)
  const isSecure = baseURL.startsWith('https')
  const cookieName = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  await context.addCookies([{
    name: cookieName,
    value: data.sessionToken,
    domain: new URL(baseURL).hostname,
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
  }])

  return data
}

/**
 * Get the guestUserId cookie value from the browser context.
 */
export async function getGuestCookie(
  context: BrowserContext,
  baseURL: string
): Promise<string | undefined> {
  const cookies = await context.cookies(baseURL)
  return cookies.find(c => c.name === 'guestUserId')?.value
}

/**
 * Send a chat message in InlineChat and wait for the assistant response.
 */
export async function sendMessage(page: Page, text: string): Promise<void> {
  const input = page.locator('textarea[placeholder*="Start anywhere"]')
  await input.fill(text)
  // Send via button click (more reliable than keyboard shortcut)
  await page.locator('button:has-text("Send")').click()
  // Wait for assistant response to appear (new message after ours)
  await expect(page.locator('[data-section="messages"] >> text=Assistant')).toBeVisible({ timeout: 30_000 })
    .catch(() => {
      // Fallback: just wait for loading to finish
    })
  // Wait for loading spinner to disappear
  await expect(page.locator('button:has-text("Send")')).toBeEnabled({ timeout: 30_000 })
}

/**
 * Trigger strategy generation via the Finish flow.
 * Clicks Finish button → confirms in dialog → waits for pipeline.
 */
export async function triggerGeneration(page: Page): Promise<void> {
  // Click Finish button
  await page.locator('button:has-text("Finish")').click()

  // Confirm in the dialog (text varies by message count)
  const confirmButton = page.locator('button:has-text("Finish anyway"), button:has-text("Generate strategy")')
  await confirmButton.click()
}

/**
 * Wait for the pipeline to complete (extraction + generation).
 * Watches for progress indicators to appear and then resolve to dashboard.
 */
export async function waitForPipelineComplete(page: Page): Promise<void> {
  // Wait for extraction/generation progress to start
  await expect(
    page.locator('text=/extracting|drafting|generating/i').first()
  ).toBeVisible({ timeout: 30_000 })

  // Wait for strategy card to appear (signals generation complete + dashboard loaded)
  await expect(
    page.locator('text="Your Decision Stack"')
  ).toBeVisible({ timeout: 60_000 })
}

/**
 * Fetch project data from the API (for assertions on server state).
 */
export async function fetchProjectData(
  context: BrowserContext,
  baseURL: string,
  projectId: string
) {
  const response = await context.request.get(`${baseURL}/api/project/${projectId}`)
  expect(response.ok()).toBeTruthy()
  return response.json()
}
