import * as React from 'react'
import { Heading, Paragraph } from '../components'
import type { BroadcastContent } from '../broadcast-template'

export const broadcastContent: BroadcastContent = {
  subject: 'Example broadcast subject',
  previewText: 'Short preview text that shows in the inbox preview',
  body: (
    <>
      <Heading>Hello from Lunastak</Heading>
      <Paragraph>
        This is an example broadcast template. Duplicate this file (with a new
        date prefix) and edit the body for each campaign.
      </Paragraph>
      <Paragraph>
        Cheers,
        <br />
        Jonny
      </Paragraph>
    </>
  ),
}

export default broadcastContent
