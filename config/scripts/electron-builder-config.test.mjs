import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')

const require = createRequire(import.meta.url)
const electronBuilderConfig = require('../electron-builder.config.cjs')
const { FileMatcher } = require('app-builder-lib/out/fileMatcher')
const FpmTarget = require('app-builder-lib/out/targets/FpmTarget').default
const electronBuilderNativeRebuild = require('./electron-builder-native-rebuild.cjs')

describe('electron-builder config', () => {
  it('packages the desktop as Kondex without an inherited upstream release target', () => {
    expect(electronBuilderConfig).toMatchObject({
      appId: 'app.kondex.desktop',
      productName: 'Kondex',
      protocols: [{ name: 'Kondex', schemes: ['kondex'] }],
      publish: []
    })
    expect(electronBuilderConfig.win.executableName).toBe('Kondex')
    expect(electronBuilderConfig.win.signtoolOptions).toBeUndefined()
    expect(electronBuilderConfig.nsis.artifactName).toBe('kondex-windows-setup.${ext}')
    expect(electronBuilderConfig.dmg.artifactName).toBe('kondex-macos-${arch}.${ext}')
    expect(electronBuilderConfig.mac.extendInfo.NSAppleEventsUsageDescription).toContain('Kondex')
    expect(electronBuilderConfig.linux.desktop.entry.StartupWMClass).toBe('kondex')
    expect(electronBuilderConfig.linux.executableName).toBe('kondex')
    expect(electronBuilderConfig.linux.maintainer).toBe('Kondex contributors')
  })

  it('excludes repo-only source trees from app.asar', () => {
    expect(electronBuilderConfig.files).toEqual(
      expect.arrayContaining([
        '!src{,/**/*}',
        '!config{,/**/*}',
        '!docs{,/**/*}',
        '!mobile{,/**/*}',
        '!native{,/**/*}',
        '!skills{,/**/*}',
        '!skill-guides{,/**/*}',
        '!skill-stubs{,/**/*}',
        '!resources/skills/**',
        '!resources/kontext/**',
        '!tests{,/**/*}',
        '!examples{,/**/*}',
        '!pr-evidence{,/**/*}',
        '!{.claude,.grok,.agents,.codex}{,/**/*}',
        '!{AGENTS.md,CLAUDE.md,DEVELOPING.md,bundle-size-progress.md,ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md,ORCHESTRATION_STRUCTURED_OUTPUT_DESIGN.md}',
        '!out/**/*.test.js'
      ])
    )
  })

  it('keeps local agent tooling out of app.asar', () => {
    const matcher = new FileMatcher('/app', '/dest', (value) => value, electronBuilderConfig.files)
    matcher.prependPattern('**/*')
    const isPacked = matcher.createFilter()
    const packs = (repoPath) => isPacked(join('/app', repoPath), { isDirectory: () => false })

    for (const toolingPath of [
      '.grok/skills/review-and-submit/review-and-submit/SKILL.md',
      '.claude/skills/review-and-submit/review-and-submit/SKILL.md',
      '.agents/skills/electron/SKILL.md',
      '.codex/sessions/session.json'
    ]) {
      expect(packs(toolingPath)).toBe(false)
    }
    expect(packs('out/main/index.js')).toBe(true)
  })

  // Why: `files` is an all-negation list, so electron-builder's default `**/*` packs
  // anything without an explicit `!` entry — examples/ landed without one and shipped
  // hostile-panel, the adversarial containment fixture, into 1.4.160-rc.3's app.asar.
  // Drive the real matcher: pinning the pattern string cannot prove it excludes the tree.
  it('keeps plugin authoring examples out of app.asar', () => {
    const matcher = new FileMatcher('/app', '/dest', (value) => value, electronBuilderConfig.files)
    // copyFiles() prepends this itself once the pattern list is all-negation.
    matcher.prependPattern('**/*')
    const isPacked = matcher.createFilter()
    const packs = (repoPath) => isPacked(join('/app', repoPath), { isDirectory: () => false })

    for (const authoringOnly of [
      'examples/plugins/hostile-panel/panel.html',
      'examples/plugins/hostile-panel/orca-plugin.json',
      'examples/plugins/hello-orca/main.mjs',
      'examples/plugins/hello-orca/orca-plugin.json'
    ]) {
      expect(packs(authoringOnly)).toBe(false)
    }
    // The negation stays anchored at the app root, so nested `examples` segments still ship.
    expect(packs('out/main/examples/index.js')).toBe(true)
  })

  // Why: out/electron-dev holds `pnpm dev`'s cached Electron.app copies (~270MB per branch).
  // CI never creates it, so only a local package would have hit this -- silently, as bulk.
  it('keeps cached dev Electron bundles out of app.asar', () => {
    const matcher = new FileMatcher('/app', '/dest', (value) => value, electronBuilderConfig.files)
    matcher.prependPattern('**/*')
    const isPacked = matcher.createFilter()
    const packs = (repoPath) => isPacked(join('/app', repoPath), { isDirectory: () => false })

    for (const devBundlePath of [
      'out/electron-dev/1a2b3c4d5e6f/Orca: dev.app/Contents/MacOS/Electron',
      'out/electron-dev/1a2b3c4d5e6f/orca-dev-electron-app.json'
    ]) {
      expect(packs(devBundlePath)).toBe(false)
    }
    // The real build outputs sit beside it under out/ and must still ship.
    expect(packs('out/main/index.js')).toBe(true)
    expect(packs('out/renderer/index.html')).toBe(true)
  })

  it('keeps runtime resources available through extraResources', () => {
    for (const platform of ['mac', 'linux', 'win']) {
      expect(electronBuilderConfig[platform].extraResources).toContainEqual({
        from: 'resources/skills',
        to: 'skills'
      })
      expect(electronBuilderConfig[platform].extraResources).toContainEqual({
        from: 'resources/kontext/server.mjs',
        to: 'kontext/server.mjs'
      })
      expect(electronBuilderConfig[platform].extraResources).toContainEqual({
        from: 'resources/kontext/ort-wasm-simd-threaded.wasm',
        to: 'kontext/ort-wasm-simd-threaded.wasm'
      })
      expect(electronBuilderConfig[platform].extraResources).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ to: 'onboarding/feature-wall' })])
      )
    }
    expect(electronBuilderConfig.mac.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'native/computer-use-macos/.build/release/Kondex Computer Use.app',
          to: 'Kondex Computer Use.app'
        })
      ])
    )
    expect(electronBuilderConfig.linux.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'native/computer-use-linux/runtime.py',
          to: 'computer-use-linux/runtime.py'
        })
      ])
    )
    expect(electronBuilderConfig.win.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'native/computer-use-windows/runtime.ps1',
          to: 'computer-use-windows/runtime.ps1'
        }),
        expect.objectContaining({
          from: 'native/windows-cli-launcher/.build/kondex.exe',
          to: 'bin/kondex.exe'
        })
      ])
    )
  })

  it('ships one macOS serve-sim package through the runtime closure', () => {
    const serveSimResources = electronBuilderConfig.mac.extraResources.filter((resource) =>
      [join('node_modules', 'serve-sim'), 'serve-sim'].includes(resource.to)
    )

    expect(serveSimResources).toEqual([
      expect.objectContaining({ to: join('node_modules', 'serve-sim') })
    ])
  })

  // Why: the Windows CLI shim is delivered only via extraResources to
  // resources/bin/kondex.cmd (beside the native resources/bin/kondex.exe). If the
  // source tree is also packed into app.asar it gets extracted by
  // asarUnpack:['resources/**'] to app.asar.unpacked/resources/win32/bin/kondex.cmd,
  // a duplicate with no adjacent kondex.exe that fails to launch (#7351).
  it('keeps the Windows CLI shim source tree out of app.asar', () => {
    expect(electronBuilderConfig.files).toEqual(
      expect.arrayContaining(['!resources/win32{,/**/*}'])
    )
    // Regression guard: the working shim must still ship via extraResources.
    expect(electronBuilderConfig.win.extraResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'resources/win32/bin/kondex.cmd',
          to: 'bin/kondex.cmd'
        })
      ])
    )
  })

  // Why: on macOS 26 UNUserNotificationCenter aborts for executables launched
  // from Contents/Resources, so the helper must ship in Contents/MacOS (#7929).
  it('ships the mac notification-status helper in Contents/MacOS, not Resources', () => {
    expect(electronBuilderConfig.mac.extraFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'native/notification-status-macos/.build/release/orca-notification-status',
          to: 'MacOS/orca-notification-status'
        })
      ])
    )
    expect(electronBuilderConfig.mac.extraResources).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ to: 'orca-notification-status' })])
    )
  })

  it('ships the mac keyboard-layout helper in Contents/MacOS, not Resources', () => {
    expect(electronBuilderConfig.mac.extraFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'native/keyboard-layout-macos/.build/release/orca-keyboard-layout',
          to: 'MacOS/orca-keyboard-layout'
        })
      ])
    )
    expect(electronBuilderConfig.mac.extraResources).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ to: 'orca-keyboard-layout' })])
    )
  })

  it('unpacks the compiled CommonJS boundary with CLI runtime files', () => {
    expect(electronBuilderConfig.asarUnpack).toEqual(
      expect.arrayContaining([
        'out/package.json',
        'out/cli/**',
        'out/shared/**',
        'out/main/claude-accounts/keychain.js'
      ])
    )
  })

  // Why: without the unpacked entry the watcher client silently falls back to
  // in-process @parcel/watcher, reintroducing the #7547 main-process crash.
  it('unpacks the forked parcel-watcher process entry', () => {
    expect(electronBuilderConfig.asarUnpack).toEqual(
      expect.arrayContaining(['out/main/parcel-watcher-process-entry.js'])
    )
  })

  it('unpacks the replaceable WSL transcript filesystem process entry', async () => {
    const entryFilename = 'wsl-transcript-fs-process-entry.js'
    expect(electronBuilderConfig.asarUnpack).toContain(`out/main/${entryFilename}`)

    const viteConfig = await readFile(join(REPO_ROOT, 'electron.vite.config.ts'), 'utf8')
    expect(viteConfig).toMatch(new RegExp(`'${entryFilename.replace(/\.js$/, '')}':\\s*resolve\\(`))
  })

  it('does not retain the retired OpenCode worker in build or packaging entries', async () => {
    expect(electronBuilderConfig.asarUnpack.join('\n')).not.toContain('opencode')
    const viteConfig = await readFile(join(REPO_ROOT, 'electron.vite.config.ts'), 'utf8')
    expect(viteConfig).not.toContain('session-scanner-opencode-sqlite-worker')
  })

  it('builds and verifies a separately identified Kondex computer helper', async () => {
    const buildScript = await readFile(
      join(import.meta.dirname, 'build-computer-macos.mjs'),
      'utf8'
    )
    const verifyScript = await readFile(
      join(import.meta.dirname, 'verify-computer-native.mjs'),
      'utf8'
    )
    expect(buildScript).toContain("'app.kondex.desktop.computer-use'")
    expect(buildScript).toContain("const displayName = 'Kondex Computer Use'")
    expect(buildScript).not.toContain('com.stablyai.orca.computer-use')
    expect(buildScript).toContain('Kondex Computer Use.app')
    expect(verifyScript).toContain('Kondex Computer Use.app')
  })

  it('keeps the worker-thread hang watchdog inside app.asar', () => {
    expect(electronBuilderConfig.asarUnpack).not.toContain(
      'out/main/main-thread-hang-watchdog-entry.js'
    )
  })

  it('uses the multi-size icon source for Linux packages', () => {
    expect(electronBuilderConfig.linux.icon).toBe('resources/build/icon.icns')
  })

  it('matches the Linux desktop entry to Electron window class', () => {
    expect(electronBuilderConfig.linux.desktop.entry.StartupWMClass).toBe('kondex')
  })

  it('uses deterministic Kondex names for local Linux packages', () => {
    expect(electronBuilderConfig.linux.target).toEqual(['AppImage', 'deb', 'rpm'])
    expect(electronBuilderConfig.toolsets).toEqual({ appimage: '1.0.3' })
    expect(electronBuilderConfig.appImage.artifactName).toBe('kondex-linux-${arch}.${ext}')
    expect(electronBuilderConfig.deb.artifactName).toBe('kondex_${version}_${arch}.${ext}')
    expect(electronBuilderConfig.rpm).toMatchObject({
      packageName: 'kondex',
      artifactName: 'kondex-${version}.${arch}.${ext}'
    })
  })

  it('retains electron-builder runtime dependencies in deb and rpm packages', () => {
    for (const target of ['deb', 'rpm']) {
      const dependencies = electronBuilderConfig[target].depends
      expect(dependencies).toEqual(
        expect.arrayContaining(FpmTarget.prototype.getDefaultDepends(target))
      )
      expect(new Set(dependencies).size).toBe(dependencies.length)
    }
  })

  it('validates each AppImage after electron-builder creates it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-electron-builder-appimage-'))
    try {
      const appImage = join(root, 'kondex-linux-x64.AppImage')
      await writeFile(appImage, 'not an ELF')
      await chmod(appImage, 0o755)

      expect(() =>
        electronBuilderConfig.artifactBuildCompleted({ file: appImage, arch: 1 })
      ).toThrow(/ELF header is outside/)
      expect(() =>
        electronBuilderConfig.artifactBuildCompleted({ file: join(root, 'kondex.deb') })
      ).not.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  it('overrides packaged semver for an explicitly versioned local build', () => {
    const configPath = require.resolve('../electron-builder.config.cjs')
    const original = process.env.KONDEX_LOCAL_BUILD_VERSION
    try {
      delete require.cache[configPath]
      process.env.KONDEX_LOCAL_BUILD_VERSION = '1.4.159-rc.0.local.123.abc'
      expect(require('../electron-builder.config.cjs').extraMetadata).toEqual({
        version: '1.4.159-rc.0.local.123.abc'
      })
    } finally {
      if (original === undefined) {
        delete process.env.KONDEX_LOCAL_BUILD_VERSION
      } else {
        process.env.KONDEX_LOCAL_BUILD_VERSION = original
      }
      delete require.cache[configPath]
      require('../electron-builder.config.cjs')
    }
  })

  it('uses Orca native rebuild hook instead of electron-builder default rebuild', () => {
    expect(electronBuilderConfig.beforeBuild).toBe(electronBuilderNativeRebuild)
    expect(electronBuilderConfig.npmRebuild).toBe(true)
  })
})
