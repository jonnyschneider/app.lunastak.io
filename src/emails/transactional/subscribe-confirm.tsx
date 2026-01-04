/**
 * Subscribe confirmation email template
 *
 * NOTE: This is adapted from the marketing site
 * (lunastak.io/emails/transactional/early-access-confirm.tsx).
 * The app version is used for in-app signup flow (after using as guest).
 * If updating this file, consider whether the marketing site also needs updating.
 */
import { Heading, Link, Section, Text } from '@react-email/components'
import * as React from 'react'
import { EmailLayout } from '../components/EmailLayout'

interface SubscribeConfirmEmailProps {
  confirmationLink: string
}

export const SubscribeConfirmEmail = ({ confirmationLink }: SubscribeConfirmEmailProps) => {
  return (
    <EmailLayout preview="Confirm your Lunastak account">
      <Section style={content}>
        <Heading style={h1}>Confirm your email</Heading>

        <Text style={text}>
          Thanks for using Lunastak!
        </Text>

        <Text style={text}>
          To save your strategy and access it anytime, please confirm your email address:
        </Text>

        {/* CTA Button */}
        <Section style={buttonContainer}>
          <Link href={confirmationLink} style={button}>
            Confirm & Sign In
          </Link>
        </Section>

        <Text style={textSmall}>
          This link will expire in 24 hours.
        </Text>

        <Text style={textSmall}>
          If you didn't request this email, you can safely ignore it.
        </Text>
      </Section>
    </EmailLayout>
  )
}

const content = {
  padding: '20px',
}

const h1 = {
  color: '#13231C',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0 0 20px',
  lineHeight: '1.2',
}

const text = {
  color: '#515856',
  fontSize: '16px',
  lineHeight: '165%',
  margin: '0 0 16px',
}

const textSmall = {
  color: '#919191',
  fontSize: '14px',
  lineHeight: '150%',
  margin: '16px 0 0',
}

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#77CC88',
  borderRadius: '6px',
  color: '#13231C',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '16px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

export default SubscribeConfirmEmail

SubscribeConfirmEmail.PreviewProps = {
  confirmationLink: 'https://app.lunastak.io/api/subscribe/confirm?token=example123',
} as SubscribeConfirmEmailProps
