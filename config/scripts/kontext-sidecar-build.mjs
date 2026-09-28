/** Why a spawnSync result counts as a failed build step, or null when it succeeded. */
export function describeSpawnFailure(result) {
  // Why: a spawn that never started has status null and only `.error` set.
  if (result.error) {
    return `could not start (${result.error.message})`
  }
  if (result.signal) {
    return `was killed by ${result.signal}`
  }
  if (result.status !== 0) {
    return `exited with status ${result.status}`
  }
  return null
}
