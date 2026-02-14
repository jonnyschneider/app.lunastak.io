jest.mock('@/lib/claude', () => ({
  CLAUDE_MODEL: 'claude-sonnet-4-5-20250929',
}))

import { planPipeline } from '@/lib/pipeline/plan'
import type { PipelineTrigger } from '@/lib/pipeline/types'

describe('planPipeline', () => {
  const baseConversation: PipelineTrigger & { type: 'conversation_ended' } = {
    type: 'conversation_ended',
    projectId: 'proj-1',
    conversationId: 'conv-1',
    userId: 'user-1',
    isInitial: true,
    experimentVariant: 'emergent-extraction-e1a',
  }

  describe('conversation_ended (initial)', () => {
    it('should run full pipeline: extract + fragments + synthesis + summary + generate', () => {
      const plan = planPipeline(baseConversation)

      expect(plan.trigger).toBe('conversation_ended')
      expect(plan.extraction).toEqual({ approach: 'emergent', source: 'conversation' })
      expect(plan.persistFragments).toBe(true)
      expect(plan.runSynthesis).toBe(true)
      expect(plan.runKnowledgeSummary).toBe(true)
      expect(plan.generation).toEqual({ mode: 'initial', source: 'extracted_context' })
    })

    it('should run synthesis and knowledgeSummary as background steps', () => {
      const plan = planPipeline(baseConversation)

      expect(plan.backgroundSteps).toContain('synthesis')
      expect(plan.backgroundSteps).toContain('knowledgeSummary')
    })
  })

  describe('conversation_ended (follow-up / lightweight)', () => {
    it('should run extract + fragments only, no synthesis or generation', () => {
      const plan = planPipeline({
        ...baseConversation,
        isInitial: false,
      })

      expect(plan.extraction).toEqual({ approach: 'emergent', source: 'conversation' })
      expect(plan.persistFragments).toBe(true)
      expect(plan.runSynthesis).toBe(false)
      expect(plan.runKnowledgeSummary).toBe(false)
      expect(plan.generation).toBeNull()
    })
  })

  describe('document_uploaded', () => {
    it('should extract + fragments + synthesis + summary, no generation', () => {
      const plan = planPipeline({
        type: 'document_uploaded',
        projectId: 'proj-1',
        documentId: 'doc-1',
        documentText: 'Some document content...',
      })

      expect(plan.extraction).toEqual({ approach: 'document', source: 'document' })
      expect(plan.persistFragments).toBe(true)
      expect(plan.runSynthesis).toBe(true)
      expect(plan.runKnowledgeSummary).toBe(true)
      expect(plan.generation).toBeNull()
    })
  })

  describe('template_submitted', () => {
    it('should generate from user input, no extraction or fragments', () => {
      const plan = planPipeline({
        type: 'template_submitted',
        projectId: 'proj-1',
        userId: 'user-1',
        statements: {
          vision: 'Test vision',
          strategy: 'Test strategy',
          objectives: [],
          opportunities: [],
          principles: [],
        },
      })

      expect(plan.extraction).toBeNull()
      expect(plan.persistFragments).toBe(false)
      expect(plan.runSynthesis).toBe(false)
      expect(plan.generation).toEqual({ mode: 'template', source: 'user_input' })
    })
  })

  describe('refresh_requested', () => {
    it('should generate from fragments and syntheses, no extraction', () => {
      const plan = planPipeline({
        type: 'refresh_requested',
        projectId: 'proj-1',
        userId: 'user-1',
      })

      expect(plan.extraction).toBeNull()
      expect(plan.persistFragments).toBe(false)
      expect(plan.runSynthesis).toBe(false)
      expect(plan.generation).toEqual({ mode: 'refresh', source: 'fragments_and_syntheses' })
    })
  })
})
