/**
 * Picks the first sidecar bundle that serves every tool Kondex calls, and keeps
 * the reason each earlier candidate lost. Kept free of I/O so the packaging
 * decision can be tested without spawning a server.
 */
export async function selectVerifiedKontextSidecar({
  candidates,
  exists,
  findMissingTools,
  priorRejections = []
}) {
  const rejected = [...priorRejections]
  for (const candidate of candidates) {
    if (!exists(candidate.path)) {
      continue
    }
    let missing
    try {
      missing = await findMissingTools(candidate.path)
    } catch (error) {
      rejected.push(`${candidate.path}: did not start (${String(error)})`)
      continue
    }
    if (missing.length > 0) {
      rejected.push(`${candidate.path}: does not serve ${missing.join(', ')}`)
      continue
    }
    return { chosen: candidate, rejected }
  }
  return { chosen: null, rejected }
}
