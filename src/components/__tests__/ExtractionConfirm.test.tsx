import { render, screen } from '@testing-library/react'
import ExtractionConfirm from '../ExtractionConfirm'
import { EmergentExtractedContext, PrescriptiveExtractedContext } from '@/lib/types'

describe('ExtractionConfirm', () => {
  const mockCallbacks = {
    onGenerate: vi.fn(),
    onContinue: vi.fn(),
    onFlagForLater: vi.fn(),
    onDismiss: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders emergent variant with themes', () => {
    const emergentContext: EmergentExtractedContext = {
      themes: [
        { theme_name: 'Customer Pain', content: 'Description of customer pain points' }
      ],
      reflective_summary: {
        strengths: [],
        emerging: [],
        opportunities_for_enrichment: []
      },
      extraction_approach: 'emergent'
    }

    render(<ExtractionConfirm extractedContext={emergentContext} {...mockCallbacks} />)

    expect(screen.getByText('Customer Pain')).toBeInTheDocument()
    expect(screen.getByText('Description of customer pain points')).toBeInTheDocument()
  })

  it('renders prescriptive variant with core fields', () => {
    const prescriptiveContext: PrescriptiveExtractedContext = {
      core: {
        industry: 'SaaS',
        target_market: 'SMBs',
        unique_value: 'Speed'
      },
      enrichment: {},
      reflective_summary: {
        strengths: [],
        emerging: [],
        opportunities_for_enrichment: []
      },
      extraction_approach: 'prescriptive'
    }

    render(<ExtractionConfirm extractedContext={prescriptiveContext} {...mockCallbacks} />)

    expect(screen.getByText('SaaS')).toBeInTheDocument()
    expect(screen.getByText('SMBs')).toBeInTheDocument()
    expect(screen.getByText('Speed')).toBeInTheDocument()
  })

  it('shows error for invalid structure', () => {
    const invalidContext = {
      extraction_approach: 'prescriptive',
      // Missing 'core' field
      reflective_summary: {
        strengths: [],
        emerging: [],
        opportunities_for_enrichment: []
      }
    } as any

    render(<ExtractionConfirm extractedContext={invalidContext} {...mockCallbacks} />)

    expect(screen.getByText(/Invalid extraction data structure/i)).toBeInTheDocument()
  })

  it('calls onGenerate when button clicked', () => {
    const prescriptiveContext: PrescriptiveExtractedContext = {
      core: {
        industry: 'SaaS',
        target_market: 'SMBs',
        unique_value: 'Speed'
      },
      enrichment: {},
      reflective_summary: {
        strengths: [],
        emerging: [],
        opportunities_for_enrichment: []
      },
      extraction_approach: 'prescriptive'
    }

    render(<ExtractionConfirm extractedContext={prescriptiveContext} {...mockCallbacks} />)

    const generateButton = screen.getByText('Generate my strategy')
    generateButton.click()

    expect(mockCallbacks.onGenerate).toHaveBeenCalledTimes(1)
  })
})
