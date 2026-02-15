import {
  validateExtractionStatusResponse,
  isExtractionInProgress,
  isExtractionFinished,
} from '@/lib/contracts/extraction-status'

describe('ExtractionStatusResponseContract', () => {
  it('validates extracting status', () => {
    expect(validateExtractionStatusResponse({ status: 'extracting' })).toBe(true)
  })

  it('validates extracted status with fragmentCount', () => {
    expect(
      validateExtractionStatusResponse({ status: 'extracted', fragmentCount: 5 })
    ).toBe(true)
  })

  it('rejects extracted status without fragmentCount', () => {
    expect(
      validateExtractionStatusResponse({ status: 'extracted' })
    ).toBe(false)
  })

  it('validates extraction_failed status with error', () => {
    expect(
      validateExtractionStatusResponse({
        status: 'extraction_failed',
        error: 'Connection terminated',
      })
    ).toBe(true)
  })

  it('rejects extraction_failed without error', () => {
    expect(
      validateExtractionStatusResponse({ status: 'extraction_failed' })
    ).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(validateExtractionStatusResponse({ status: 'pending' })).toBe(false)
  })

  it('rejects non-object', () => {
    expect(validateExtractionStatusResponse(null)).toBe(false)
    expect(validateExtractionStatusResponse('string')).toBe(false)
  })
})

describe('status helpers', () => {
  it('isExtractionInProgress', () => {
    expect(isExtractionInProgress('extracting')).toBe(true)
    expect(isExtractionInProgress('extracted')).toBe(false)
    expect(isExtractionInProgress('extraction_failed')).toBe(false)
  })

  it('isExtractionFinished', () => {
    expect(isExtractionFinished('extracted')).toBe(true)
    expect(isExtractionFinished('extraction_failed')).toBe(true)
    expect(isExtractionFinished('extracting')).toBe(false)
  })
})
