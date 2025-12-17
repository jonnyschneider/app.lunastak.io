'use client'

import { Card } from '@/components/ui/card'

interface IntroCardProps {
  onStartClick: () => void
}

export function IntroCard({ onStartClick }: IntroCardProps) {
  return (
    <Card className="p-8 max-w-2xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to Decision Stack</h1>

      <div className="space-y-4 text-gray-600 mb-6">
        <p>
          I'm here to help you crystallize your business thinking into a clear strategic direction.
        </p>

        <p>
          Through conversation, I'll understand your business context and generate:
        </p>

        <ul className="list-disc ml-6 space-y-2">
          <li><strong>Vision:</strong> Your long-term aspirations</li>
          <li><strong>Mission:</strong> How you'll serve customers and create value</li>
          <li><strong>Strategic Objectives:</strong> What you need to focus on to get there</li>
        </ul>

        <p>
          <strong>What to expect:</strong> I'll ask questions about your business, customers, value proposition, and competitive landscape. This usually takes 5-10 minutes.
        </p>

        <p className="text-sm text-gray-500">
          <strong>Privacy:</strong> You can use this tool anonymously. If you'd like to save your strategies and return later, you can sign in with your email after we're done.
        </p>
      </div>

      <button
        onClick={onStartClick}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        Let's Begin
      </button>
    </Card>
  )
}
