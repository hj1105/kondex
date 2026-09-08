import { useEffect, useRef, useState } from 'react'
import { getRuntimeEnvironmentRevision } from '@/runtime/runtime-environment-revision'
import { sameKontextOwner, type KontextRequestOwner } from './kontext-request-journal'

export function useKontextHostInventory<Page extends { nextCursor: unknown }>(
  owner: KontextRequestOwner,
  readPage: (previous: Page | null) => Promise<Page>
) {
  const [page, setPage] = useState<Page | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(false)
  const [failed, setFailed] = useState(false)
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
    if (!busy) {
      setProgress(false)
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
  async function load(more = false) {
    if (inFlight.current || (more && !page?.nextCursor)) {
      return
    }
    const previous = more ? page : null
    if (!more) {
      setPage(null)
    }
    setFailed(false)
    if (!current()) {
      setPage(null)
      setFailed(true)
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const result = await readPage(previous)
      if (!current()) {
        throw new Error('Owner changed')
      }
      setPage(result)
    } catch {
      if (alive.current) {
        setPage(null)
        setFailed(true)
      }
    } finally {
      inFlight.current = false
      if (alive.current) {
        setBusy(false)
      }
    }
  }
  return { page, busy, progress, failed, current, load }
}
