import { Section } from '@react-email/components'
import * as React from 'react'
import { Button, EmailLayout, Heading, Paragraph } from '../components'

interface SubscribeConfirmEmailProps {
  confirmationLink: string
}

export const SubscribeConfirmEmail = ({ confirmationLink }: SubscribeConfirmEmailProps) => {
  return (
    <EmailLayout preview="Confirm your Lunastak account">
      <Heading>Confirm your email</Heading>
      <Paragraph>Thanks for using Lunastak!</Paragraph>
      <Paragraph>
        To save your strategy and access it anytime, please confirm your email address:
      </Paragraph>

      <Section style={{ margin: '32px 0', textAlign: 'center' }}>
        <Button href={confirmationLink}>Confirm & Sign In</Button>
      </Section>

      <Paragraph small>This link will expire in 24 hours.</Paragraph>
      <Paragraph small>If you didn't request this email, you can safely ignore it.</Paragraph>
    </EmailLayout>
  )
}

export default SubscribeConfirmEmail

SubscribeConfirmEmail.PreviewProps = {
  confirmationLink: 'https://app.lunastak.io/api/subscribe/confirm?token=example',
} as SubscribeConfirmEmailProps
