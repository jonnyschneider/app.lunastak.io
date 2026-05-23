import * as React from 'react'
import { EmailLayout, Heading, Paragraph } from '../components'

interface WaitlistConfirmEmailProps {
  feature?: string
}

export const WaitlistConfirmEmail = ({ feature }: WaitlistConfirmEmailProps) => {
  return (
    <EmailLayout preview="You're on the early access list">
      <Heading>You're on the list</Heading>
      <Paragraph>
        Thanks for joining the Lunastak early access list
        {feature ? ` for ${feature}` : ''}. We'll let you know as soon as new
        Pro features are ready.
      </Paragraph>
      <Paragraph>
        In the meantime, keep using Lunastak to refine your strategy — your
        feedback shapes what we build next.
      </Paragraph>
      <Paragraph small>— Luna</Paragraph>
    </EmailLayout>
  )
}

export default WaitlistConfirmEmail

WaitlistConfirmEmail.PreviewProps = { feature: 'Pro analytics' } as WaitlistConfirmEmailProps
