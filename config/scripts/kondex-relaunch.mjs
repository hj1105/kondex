#!/usr/bin/env node
/**
 * Rebuilds the local package, quits the Kondex that is running from it, and
 * opens the new one. This is the "update" for a checkout that has no signed
 * release lane: without it a rebuilt dist/ sits unused while the old process
 * keeps running, and closing the window alone does not quit the app.
 *
 *   pnpm relaunch            build:unpack, then quit and reopen
 *   pnpm relaunch --no-build reopen the package that is already in dist/
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const KONDEX_BUNDLE_ID = 'app.kondex.desktop'

/** Where electron-builder --dir puts the app for this host, and how to run it. */
export function packagedAppLocation({ platform, arch, repoRoot }) {
  if (platform === 'darwin') {
    const appPath = path.join(
      repoRoot,
      'dist',
      arch === 'arm64' ? 'mac-arm64' : 'mac',
      'Kondex.app'
    )
    return {
      appPath,
      executable: path.join(appPath, 'Contents', 'MacOS', 'Kondex'),
      processName: 'Kondex'
    }
  }
  if (platform === 'win32') {
    const appPath = path.join(repoRoot, 'dist', 'win-unpacked')
    return { appPath, executable: path.join(appPath, 'Kondex.exe'), processName: 'Kondex.exe' }
  }
  const appPath = path.join(repoRoot, 'dist', 'linux-unpacked')
  return { appPath, executable: path.join(appPath, 'kondex'), processName: 'kondex' }
}

/** Asks the running app to quit the way the menu does, so it saves its session first. */
export function quitCommand({ platform, processName }) {
  if (platform === 'darwin') {
    return {
      command: 'osascript',
      args: ['-e', `tell application id "${KONDEX_BUNDLE_ID}" to quit`]
    }
  }
  if (platform === 'win32') {
    return { command: 'taskkill', args: ['/IM', processName] }
  }
  return { command: 'pkill', args: ['-x', processName] }
}

export function launchCommand({ platform, appPath, executable }) {
  if (platform === 'darwin') {
    return { command: 'open', args: ['-a', appPath] }
  }
  return { command: executable, args: [] }
}

/**
 * Finds the app by process name, not by path: `ps` escapes non-ASCII bytes in a
 * command line (this checkout lives under a Korean directory name), so a path
 * comparison silently misses the very process this script exists to replace.
 */
export function runningQuery({ platform, processName }) {
  if (platform === 'win32') {
    return { command: 'tasklist', args: ['/FI', `IMAGENAME eq ${processName}`, '/NH'] }
  }
  return { command: 'pgrep', args: ['-x', processName] }
}

function isRunning(location) {
  const query = runningQuery({ platform: process.platform, processName: location.processName })
  const result = spawnSync(query.command, query.args, { encoding: 'utf8' })
  if (process.platform === 'win32') {
    return result.status === 0 && result.stdout.includes(location.processName)
  }
  return result.status === 0 && result.stdout.trim() !== ''
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function quitRunning(location) {
  if (!isRunning(location)) {
    return 'not-running'
  }
  const quit = quitCommand({ platform: process.platform, processName: location.processName })
  spawnSync(quit.command, quit.args, { stdio: 'ignore' })
  for (let waited = 0; waited < 30_000; waited += 500) {
    if (!isRunning(location)) {
      return 'quit'
    }
    await sleep(500)
  }
  return 'still-running'
}

async function main() {
  const repoRoot = path.resolve(import.meta.dirname, '..', '..')
  const build = !process.argv.includes('--no-build')
  if (build) {
    // Why: npm_execpath is the pnpm that invoked this script, which needs no shell on Windows.
    const runner = process.env.npm_execpath
      ? { command: process.execPath, args: [process.env.npm_execpath, 'run', 'build:unpack'] }
      : { command: 'pnpm', args: ['run', 'build:unpack'] }
    const result = spawnSync(runner.command, runner.args, { cwd: repoRoot, stdio: 'inherit' })
    if (result.status !== 0) {
      console.error('[kondex-relaunch] build:unpack failed; the running app was left alone.')
      process.exit(result.status ?? 1)
    }
  }
  const location = packagedAppLocation({ platform: process.platform, arch: process.arch, repoRoot })
  if (!existsSync(location.executable)) {
    console.error(
      `[kondex-relaunch] no packaged app at ${location.appPath}; run pnpm build:unpack.`
    )
    process.exit(1)
  }
  const quit = await quitRunning(location)
  if (quit === 'still-running') {
    console.error('[kondex-relaunch] Kondex did not quit within 30s; not opening a second copy.')
    process.exit(1)
  }
  const launch = launchCommand({ platform: process.platform, ...location })
  const child = spawn(launch.command, launch.args, { detached: true, stdio: 'ignore' })
  child.unref()
  console.log(
    `[kondex-relaunch] ${quit === 'quit' ? 'quit the previous build and ' : ''}opened ${location.appPath}`
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main().catch((error) => {
    console.error(`[kondex-relaunch] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
