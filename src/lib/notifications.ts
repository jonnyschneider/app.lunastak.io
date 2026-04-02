async function notifySlack(message: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch (err) {
    console.error('[Slack] Failed to send notification:', err)
  }
}

export function notifySlackNewUser(email: string) {
  notifySlack(`🎉 New user signed up: ${email}`)
}

export function notifySlackStrategyGenerated(email: string, mode: 'initial' | 'refresh') {
  notifySlack(`🚀 Strategy generated (${mode}): ${email}`)
}

export function notifySlackOpportunitiesGenerated(email: string, count: number) {
  notifySlack(`🎯 ${count} opportunities drafted: ${email}`)
}

export function notifySlackUserSignIn(email: string, isNewUser: boolean) {
  if (isNewUser) return // Already covered by notifySlackNewUser
  notifySlack(`👋 User signed in: ${email}`)
}
