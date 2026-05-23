import { Section } from '@react-email/components'
import * as React from 'react'
import { Button, EmailLayout, Heading, Paragraph } from '../components'

interface MagicLinkEmailProps {
  signInUrl: string
}

export const MagicLinkEmail = ({ signInUrl }: MagicLinkEmailProps) => {
  return (
    <EmailLayout preview="Sign in to Lunastak">
      <Heading>Sign in to Lunastak</Heading>
      <Paragraph>Click the button below to sign in. This link will expire in 24 hours.</Paragraph>

      <Section style={{ margin: '32px 0', textAlign: 'center' }}>
        <Button href={signInUrl}>Sign in to Lunastak</Button>
      </Section>

      <Paragraph small>
        If you didn't request this email, you can safely ignore it.
      </Paragraph>
    </EmailLayout>
  )
}

export default MagicLinkEmail

MagicLinkEmail.PreviewProps = {
  signInUrl: 'https://app.lunastak.io/api/auth/callback/email?token=example',
} as MagicLinkEmailProps
