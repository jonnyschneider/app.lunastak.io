import { describe, it, expect } from 'vitest'
import { stackBehind, type StackBehindInputs } from '../stack-behind'

const base: StackBehindInputs = {
  sync: { version: 3, added: 4, removed: 1, comparable: true },
  hasStrategy: true,
  isDemo: false,
  generating: false,
}

describe('stackBehind — guidance register row 4', () => {
  it('names the change against the version the user is looking at', () => {
    expect(stackBehind(base)).toMatchObject({
      label: '5 changes since v3',
      detail: '4 ground truths added, 1 discarded since Version 3',
    })
  })

  it('counts discards on their own — removal is a change too', () => {
    expect(stackBehind({ ...base, sync: { version: 2, added: 0, removed: 1, comparable: true } }))
      .toMatchObject({ label: '1 change since v2', detail: '1 discarded since Version 2' })
  })

  it('singularises', () => {
    expect(stackBehind({ ...base, sync: { version: 3, added: 1, removed: 0, comparable: true } })?.detail)
      .toBe('1 ground truth added since Version 3')
  })

  it('says nothing when the stack is in sync', () => {
    expect(stackBehind({ ...base, sync: { version: 3, added: 0, removed: 0, comparable: true } })).toBeNull()
  })

  it('says nothing for a pre-fragmentIds snapshot — the panel has no changed filter to land on', () => {
    expect(stackBehind({ ...base, sync: { version: 3, added: 4, removed: 0, comparable: false } })).toBeNull()
  })

  it('says nothing without a strategy, on a demo, or while a build is running', () => {
    expect(stackBehind({ ...base, hasStrategy: false })).toBeNull()
    expect(stackBehind({ ...base, isDemo: true })).toBeNull()
    expect(stackBehind({ ...base, generating: true })).toBeNull()
    expect(stackBehind({ ...base, sync: undefined })).toBeNull()
  })

  it('falls back when the version is unknown', () => {
    expect(stackBehind({ ...base, sync: { version: null, added: 2, removed: 0, comparable: true } }))
      .toMatchObject({ label: '2 changes since this version', detail: '2 ground truths added since this version' })
  })
})
