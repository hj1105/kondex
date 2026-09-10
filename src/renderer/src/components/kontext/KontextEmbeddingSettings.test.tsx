// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KontextEmbeddingSettings } from './KontextEmbeddingSettings'

describe('KontextEmbeddingSettings', () => {
  afterEach(cleanup)

  it('shows the current choice and saves only the fields a person filled in', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const onEmbed = vi.fn()
    render(
      <KontextEmbeddingSettings
        settings={{
          provider: 'builtin',
          model: 'Xenova/multilingual-e5-small',
          baseUrl: null,
          apiKeyEnv: null
        }}
        disabled={false}
        busy={null}
        onSave={onSave}
        onEmbed={onEmbed}
      />
    )
    expect(
      screen.getByText(/Built-in model \(no install\) · Xenova\/multilingual-e5-small/)
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Embed now' }))
    expect(onEmbed).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Change…' }))
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } })
    expect(screen.getByText(/never written to kontext.yaml/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Environment variable holding the API key'), {
      target: { value: 'TEAM_OPENAI_KEY' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save embedding' }))
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    // Model and server address were left empty, so the sidecar fills its defaults.
    expect(onSave).toHaveBeenCalledWith({ provider: 'openai', apiKeyEnv: 'TEAM_OPENAI_KEY' })
  })

  it('hides the embed button when vectors are off', () => {
    render(
      <KontextEmbeddingSettings
        settings={{ provider: 'none', model: '', baseUrl: null, apiKeyEnv: null }}
        disabled={false}
        busy={null}
        onSave={vi.fn()}
        onEmbed={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Embed now' })).toBeNull()
    expect(screen.getByText(/Off \(word matching only\)/)).toBeTruthy()
  })
})
