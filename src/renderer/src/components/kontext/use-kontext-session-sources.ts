import { useEffect, useRef, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import {
  kontextSessionSourceListSchema,
  kontextSessionSourcePreviewSchema,
  type KontextSessionSourcePreview
} from '../../../../shared/kontext-session-source-contract'
import {
  kontextMarkdownSourceResultSchema,
  type KontextMarkdownSourceResult
} from '../../../../shared/kontext-source-contract'
import { sameKontextOwner, type KontextRequestOwner } from './kontext-request-journal'
import type { z } from 'zod'

export function useKontextSessionSources(owner: KontextRequestOwner) {
  const [list, setList] = useState<z.infer<typeof kontextSessionSourceListSchema> | null>(null)
  const [selected, setSelected] = useState('')
  const [preview, setPreview] = useState<KontextSessionSourcePreview | null>(null)
  const [result, setResult] = useState<KontextMarkdownSourceResult | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<'failed' | 'unsupported' | 'ownerChanged' | null>(null)
  const [busy, setBusy] = useState<'list' | 'preview' | 'register' | null>(null)
  const [progress, setProgress] = useState(false)
  const inFlight = useRef(false)
  const alive = useRef(true)
  const latestOwner = useRef(owner)
  latestOwner.current = owner
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    setProgress(false)
    if (!busy) {
      return
    }
    const timer = window.setTimeout(() => setProgress(true), 250)
    return () => window.clearTimeout(timer)
  }, [busy])
  const current = () =>
    alive.current &&
    sameKontextOwner(owner, latestOwner.current) &&
    (owner.kind === 'local' ||
      getRuntimeEnvironmentRevision(owner.environmentId) === owner.pairingRevision)
  const rpc = (method: string, params: unknown) =>
    callRuntimeRpc<unknown>(owner, method, params, {
      expectedEnvironmentPairingRevision:
        owner.kind === 'environment' ? owner.pairingRevision : undefined,
      timeoutMs: 60_000
    })
  function select(sessionId: string) {
    if (inFlight.current) {
      return
    }
    setSelected(sessionId)
    setPreview(null)
    setResult(null)
    setConsent(false)
    setError(null)
  }
  async function perform(action: 'list' | 'preview' | 'register') {
    if (inFlight.current) {
      return
    }
    const session = list?.sessions.find((item) => item.sessionId === selected)
    if (action !== 'list' && (!session || list?.registrationVersion !== 1)) {
      return
    }
    if (action === 'register' && (!preview || !consent)) {
      return
    }
    const reviewed = preview
    setConsent(false)
    setError(null)
    setResult(null)
    if (action === 'list') {
      setList(null)
      setSelected('')
    }
    if (action !== 'register') {
      setPreview(null)
    }
    if (!current()) {
      setPreview(null)
      setError('ownerChanged')
      return
    }
    inFlight.current = true
    setBusy(action)
    try {
      if (action === 'list') {
        const response = kontextSessionSourceListSchema.parse(
          await rpc('kontext.listSessionSources', {})
        )
        if (!current()) {
          throw new Error('Owner changed')
        }
        setList(response)
        if (response.registrationVersion !== 1) {
          setError('unsupported')
        }
      } else if (action === 'preview' && session && list) {
        const response = kontextSessionSourcePreviewSchema.parse(
          await rpc('kontext.previewSessionSource', { sessionId: selected })
        )
        if (!current()) {
          throw new Error('Owner changed')
        }
        if (
          response.origin.runtimeId !== list.runtimeId ||
          response.origin.sessionId !== session.sessionId ||
          response.origin.workspaceId !== session.workspaceId ||
          response.origin.provider !== session.agent
        ) {
          throw new Error('Session identity changed; reload')
        }
        setPreview(response)
      } else if (action === 'register' && reviewed) {
        const response = kontextMarkdownSourceResultSchema.parse(
          await rpc('kontext.registerSessionSource', {
            sessionId: reviewed.origin.sessionId,
            expectedContentDigest: reviewed.contentDigest
          })
        )
        if (!current()) {
          throw new Error('Owner changed')
        }
        if (
          response.contentHash !== reviewed.contentDigest ||
          response.title !== `Session ${reviewed.origin.sessionId}`
        ) {
          throw new Error('Registration not confirmed')
        }
        setResult(response)
        setPreview(null)
      }
    } catch {
      if (alive.current) {
        setPreview(null)
        setError(current() ? 'failed' : 'ownerChanged')
      }
    } finally {
      inFlight.current = false
      if (alive.current) {
        setBusy(null)
      }
    }
  }
  return {
    list,
    selected,
    select,
    preview,
    result,
    consent,
    setConsent,
    error,
    busy,
    progress,
    perform
  }
}
