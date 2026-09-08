import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeProjectsRootDirs, normalizedWslHomeDirs } from './session-scanner-roots'

describe('Claude session roots', () => {
  it('uses the local Claude projects root by default', () => {
    expect(claudeProjectsRootDirs({})).toEqual([join(homedir(), '.claude', 'projects')])
  })

  it('drops empty WSL homes and deduplicates normalized homes before discovery', () => {
    expect(normalizedWslHomeDirs(undefined)).toEqual([])
    expect(normalizedWslHomeDirs(['', '   '])).toEqual([])
    const wslHomeDirs = normalizedWslHomeDirs([
      '/wsl/ubuntu/home/ada',
      ' /wsl/ubuntu/home/ada ',
      '  '
    ])
    expect(wslHomeDirs).toEqual(['/wsl/ubuntu/home/ada'])
    expect(
      claudeProjectsRootDirs({
        claudeProjectsDir: '/home/ada/.claude/projects',
        wslHomeDirs
      })
    ).toEqual(['/home/ada/.claude/projects', join('/wsl/ubuntu/home/ada', '.claude', 'projects')])
  })
})
