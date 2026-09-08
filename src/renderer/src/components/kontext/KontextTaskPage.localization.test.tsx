// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n/i18n'
import type { KontextRuntimeInspection } from '../../../../shared/kontext-runtime-contract'

const mocks = vi.hoisted(() => ({
  loading: false,
  inspection: {
    status: 'unavailable',
    diagnostic: 'Orca-host: /srv/My Project'
  } as KontextRuntimeInspection,
  refresh: vi.fn()
}))
vi.mock('./use-kontext-runtime-inspection', () => ({
  useKontextRuntimeInspection: () => ({
    state: mocks.loading ? { status: 'loading' } : { status: 'settled', value: mocks.inspection },
    refresh: mocks.refresh
  })
}))
import KontextTaskPage from './KontextTaskPage'

beforeEach(async () => {
  mocks.loading = false
  mocks.inspection = { status: 'unavailable', diagnostic: 'Orca-host: /srv/My Project' }
  await i18n.changeLanguage('en')
})
afterEach(async () => {
  cleanup()
  mocks.refresh.mockClear()
  await i18n.changeLanguage('en')
})

describe('Kontext readiness presentation', () => {
  it('changes language live without rewriting host diagnostics or requiring a remount', async () => {
    render(<KontextTaskPage />)
    expect(screen.getByRole('heading', { name: 'Evidence-backed coding runtime' })).toBeTruthy()
    await act(async () => {
      await i18n.changeLanguage('ko')
    })
    expect(screen.getByRole('heading', { name: '근거 기반 코딩 실행 환경' })).toBeTruthy()
    expect(screen.getByText('Orca-host: /srv/My Project')).toBeTruthy()
    expect(screen.getByText('등록된 작업')).toBeTruthy()
    expect(screen.getByText('Context Receipt')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '재시도' }))
    expect(mocks.refresh).toHaveBeenCalledOnce()
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('states the integration boundary instead of inventing empty task data', () => {
    render(<KontextTaskPage />)
    expect(screen.queryByText('No published task')).toBeNull()
    expect(screen.getByText(/Starting implementation requires separate consent below/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Register / refresh source' })).toBeTruthy()
    expect(screen.getByText(/Source registration does not create a Task/)).toBeTruthy()
    expect(
      screen.getByText(/Managed context selection and final Task completion are not connected yet/)
    ).toBeTruthy()
  })

  it('describes inspection of the selected runtime, not necessarily the local machine', () => {
    mocks.loading = true
    render(<KontextTaskPage />)
    expect(screen.getByText('Inspecting the selected runtime…')).toBeTruthy()
    expect(screen.queryByText('Inspecting local runtimes…')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('keeps unreported providers unverified', () => {
    mocks.inspection = {
      status: 'ready',
      report: { capabilities: [], issues: [], eligibleProviders: [] }
    }
    render(<KontextTaskPage />)
    expect(screen.getAllByText('Not reported')).toHaveLength(2)
    expect(screen.queryByText('Ready')).toBeNull()
    expect(screen.getAllByText('Isolation unverified')).toHaveLength(2)
  })
})
