import { describe, expect, it } from 'vitest'
import {
  findAutomationListSelectionIndex,
  getAutomationListArrowNavigationTarget,
  getAutomationListEnterNavigationTarget,
  isAutomationListArrowKey,
  shouldHandleAutomationListSearchArrowKey,
  shouldHandleAutomationListSearchEnterKey
} from './automation-list-keyboard-navigation'

const items = [
  { id: 'local-1', kind: 'local' as const },
  { id: 'local-2', kind: 'local' as const }
]

describe('isAutomationListArrowKey', () => {
  it('accepts only unmodified ArrowUp/ArrowDown names', () => {
    expect(isAutomationListArrowKey('ArrowDown')).toBe(true)
    expect(isAutomationListArrowKey('ArrowUp')).toBe(true)
    expect(isAutomationListArrowKey('ArrowLeft')).toBe(false)
    expect(isAutomationListArrowKey('Enter')).toBe(false)
  })
})

describe('shouldHandleAutomationListSearchArrowKey', () => {
  function event(
    overrides: Partial<{
      key: string
      altKey: boolean
      ctrlKey: boolean
      metaKey: boolean
      shiftKey: boolean
      isComposing: boolean
    }> = {}
  ) {
    return {
      key: 'ArrowDown',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      nativeEvent: { isComposing: overrides.isComposing ?? false },
      ...overrides
    }
  }

  it('handles plain ArrowUp/ArrowDown', () => {
    expect(shouldHandleAutomationListSearchArrowKey(event())).toBe(true)
    expect(shouldHandleAutomationListSearchArrowKey(event({ key: 'ArrowUp' }))).toBe(true)
  })

  it('ignores composing, modified, and non-arrow keys', () => {
    expect(shouldHandleAutomationListSearchArrowKey(event({ isComposing: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchArrowKey(event({ metaKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchArrowKey(event({ ctrlKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchArrowKey(event({ altKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchArrowKey(event({ shiftKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchArrowKey(event({ key: 'Escape' }))).toBe(false)
  })
})

describe('findAutomationListSelectionIndex', () => {
  it('finds the selected row', () => {
    expect(findAutomationListSelectionIndex(items, 'local-2')).toBe(1)
  })

  it('returns -1 when nothing in the visible list is selected', () => {
    expect(findAutomationListSelectionIndex(items, 'missing')).toBe(-1)
    expect(findAutomationListSelectionIndex(items, null)).toBe(-1)
  })
})

describe('getAutomationListArrowNavigationTarget', () => {
  it('returns null when the list is empty', () => {
    expect(
      getAutomationListArrowNavigationTarget({
        items: [],
        selectedId: null,
        key: 'ArrowDown'
      })
    ).toBeNull()
  })

  it('selects the first row on ArrowDown and the last on ArrowUp when nothing is selected', () => {
    expect(
      getAutomationListArrowNavigationTarget({
        items,
        selectedId: null,
        key: 'ArrowDown'
      })
    ).toEqual(items[0])
    expect(
      getAutomationListArrowNavigationTarget({
        items,
        selectedId: null,
        key: 'ArrowUp'
      })
    ).toEqual(items[1])
  })

  it('steps to the next and previous visible rows', () => {
    expect(
      getAutomationListArrowNavigationTarget({
        items,
        selectedId: 'local-1',
        key: 'ArrowDown'
      })
    ).toEqual(items[1])
    expect(
      getAutomationListArrowNavigationTarget({
        items,
        selectedId: 'local-2',
        key: 'ArrowUp'
      })
    ).toEqual(items[0])
  })

  it('clamps at the ends instead of wrapping', () => {
    expect(
      getAutomationListArrowNavigationTarget({
        items,
        selectedId: 'local-1',
        key: 'ArrowUp'
      })
    ).toEqual(items[0])
    expect(
      getAutomationListArrowNavigationTarget({
        items,
        selectedId: 'local-2',
        key: 'ArrowDown'
      })
    ).toEqual(items[1])
  })
})

describe('shouldHandleAutomationListSearchEnterKey', () => {
  function event(
    overrides: Partial<{
      key: string
      altKey: boolean
      ctrlKey: boolean
      metaKey: boolean
      shiftKey: boolean
      isComposing: boolean
    }> = {}
  ) {
    return {
      key: 'Enter',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      nativeEvent: { isComposing: overrides.isComposing ?? false },
      ...overrides
    }
  }

  it('handles plain Enter', () => {
    expect(shouldHandleAutomationListSearchEnterKey(event())).toBe(true)
  })

  it('ignores composing, modified, and non-enter keys', () => {
    expect(shouldHandleAutomationListSearchEnterKey(event({ isComposing: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchEnterKey(event({ metaKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchEnterKey(event({ ctrlKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchEnterKey(event({ altKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchEnterKey(event({ shiftKey: true }))).toBe(false)
    expect(shouldHandleAutomationListSearchEnterKey(event({ key: 'ArrowDown' }))).toBe(false)
    expect(shouldHandleAutomationListSearchEnterKey(event({ key: 'Escape' }))).toBe(false)
  })
})

describe('getAutomationListEnterNavigationTarget', () => {
  it('returns null when the list is empty', () => {
    expect(
      getAutomationListEnterNavigationTarget({
        items: [],
        selectedId: null
      })
    ).toBeNull()
  })

  it('returns the first row when nothing is selected', () => {
    expect(
      getAutomationListEnterNavigationTarget({
        items,
        selectedId: null
      })
    ).toEqual(items[0])
  })

  it('returns the first row when selection is not in visible items', () => {
    expect(
      getAutomationListEnterNavigationTarget({
        items,
        selectedId: 'missing-row'
      })
    ).toEqual(items[0])
  })

  it('returns the selected local row when selected', () => {
    expect(
      getAutomationListEnterNavigationTarget({
        items,
        selectedId: 'local-2'
      })
    ).toEqual(items[1])
  })
})
