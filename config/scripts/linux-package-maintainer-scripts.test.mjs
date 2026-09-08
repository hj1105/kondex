import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Linux package maintainer scripts', () => {
  it('keeps upgrades from removing the installed CLI', () => {
    const script = readFileSync(
      new URL('../../resources/linux/packaging/after-remove.sh', import.meta.url),
      'utf8'
    )
    const unlinkStart = script.indexOf('link="/usr/bin/kondex"')
    const upgradeGuard = script.slice(0, unlinkStart)

    expect(unlinkStart).toBeGreaterThan(-1)
    expect(upgradeGuard).toContain('case "${1-}" in')
    expect(upgradeGuard).toContain('0 | remove | purge) ;;')
    expect(upgradeGuard).toContain('*) exit 0 ;;')
    expect(script).toContain('/opt/Kondex/*|/opt/kondex/*)')
    expect(script).not.toMatch(/\/usr\/bin\/(?:orca(?:-ide|-dev)?|codex)(?:["\s]|$)/)
  })
})
