import * as React from 'react'
import { EmailLayout } from './components'

export interface BroadcastContent {
  subject: string
  previewText: string
  body: React.ReactNode
}

interface BroadcastTemplateProps extends BroadcastContent {
  unsubscribeUrl: string
  webviewUrl?: string
}

export const BroadcastTemplate = ({
  previewText,
  body,
  unsubscribeUrl,
  webviewUrl,
}: BroadcastTemplateProps) => {
  return (
    <EmailLayout preview={previewText} unsubscribeUrl={unsubscribeUrl} webviewUrl={webviewUrl}>
      {body}
    </EmailLayout>
  )
}

export default BroadcastTemplate
