import { Section } from '@react-email/components'
import * as React from 'react'
import { Button, EmailLayout, Heading, Paragraph } from '../components'

interface WelcomeEmailProps {
  appUrl: string
  firstName?: string
}

export const WelcomeEmail = ({ appUrl, firstName }: WelcomeEmailProps) => {
  const greeting = firstName ? `Welcome, ${firstName}` : 'Welcome to Lunastak'

  return (
    <EmailLayout preview="Welcome to Lunastak — let's build your strategy">
      <Heading>{greeting}</Heading>

      <Paragraph>
        Thanks for signing up. Lunastak is your AI strategy coach — it turns your
        thinking into a clear, written strategy you can act on.
      </Paragraph>

      <Paragraph>
        Three things that help most users get value quickly:
      </Paragraph>

      <Paragraph>
        <strong>1. Start a project.</strong> Give it a working title — what are you trying to figure out?
        <br />
        <strong>2. Have a conversation.</strong> Talk about what you're thinking, what you've tried, what you're unsure about.
        <br />
        <strong>3. Generate your Decision Stack.</strong> Lunastak synthesises your thinking into vision, strategy, and objectives you can iterate on.
      </Paragraph>

      <Section style={{ margin: '32px 0', textAlign: 'center' }}>
        <Button href={appUrl}>Open Lunastak</Button>
      </Section>

      <Paragraph>
        Reply to this email if you have questions — it goes straight to Jonny (the
        founder). Feedback shapes what we build next.
      </Paragraph>

      <Paragraph small>— Luna</Paragraph>
    </EmailLayout>
  )
}

export default WelcomeEmail

WelcomeEmail.PreviewProps = {
  appUrl: 'https://app.lunastak.io',
  firstName: 'Sam',
} as WelcomeEmailProps
