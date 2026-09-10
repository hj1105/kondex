const { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const { join, resolve } = require('node:path')
const electronBuilderNativeRebuild = require('./scripts/electron-builder-native-rebuild.cjs')
const {
  assertPackagedDaemonEntryExists,
  verifyPackagedDaemonEntryBoots
} = require('./scripts/verify-packaged-daemon-entry.cjs')
const {
  createPackagedRuntimeNodeModuleResources,
  prunePackagedRuntimeNodeModules,
  verifyPackagedMainRuntimeDeps
} = require('./packaged-runtime-node-modules.cjs')
const { verifyLinuxGlibcFloor } = require('./scripts/verify-linux-glibc-floor.cjs')
const {
  verifyPackagedNodePtyJobOwnership
} = require('./scripts/verify-packaged-node-pty-job-ownership.cjs')
const { verifySkillsCliRuntime } = require('./scripts/verify-skills-cli-runtime.cjs')
const { verifyStaticAppImagePackage } = require('./scripts/static-appimage-package-contract.cjs')

// Local packaging is unsigned by default. A developer can opt into their own
// macOS signing/notarization setup without inheriting an upstream release lane.
const shouldSignMac = process.env.KONDEX_MAC_SIGN === '1'
const localBuildVersion = process.env.KONDEX_LOCAL_BUILD_VERSION
const appId = 'app.kondex.desktop'
// Why: freshness detection needs immutable identity metadata from this exact
// app build, but never needs the skill package bytes or a runtime network read.
const skillFreshnessResources = {
  from: 'resources/skills',
  to: 'skills'
}
// Why: the generated MCP bundle is copied from the adjacent kontext-brain-ts
// checkout immediately before packaging. Keeping it outside app.asar lets
// Electron launch it as a persistent stdio sidecar with ELECTRON_RUN_AS_NODE.
const kontextSidecarResource = {
  from: 'resources/kontext/server.mjs',
  to: 'kontext/server.mjs'
}
const kontextOntologyCliResource = {
  from: 'resources/kontext/ontology-cli.mjs',
  to: 'kontext/ontology-cli.mjs'
}
// Why: the sidecar's built-in search embedder loads these two files from its own
// directory; they are plain assets, not code the bundle can inline.
const kontextEmbeddingRuntimeResources = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm'
].map((asset) => ({ from: `resources/kontext/${asset}`, to: `kontext/${asset}` }))
// Why: SSH relay deploy resolves bundles from process.resourcesPath in packaged
// apps. Keeping relay assets as extraResources makes them real directories
// instead of paths hidden inside app.asar.
const relayExtraResource = {
  from: 'out/relay',
  to: 'relay'
}
// Why: the main bundle, packaged CLI, and SSH paths all execute
// from package directories where pnpm's symlink farm is absent. Copy the exact
// runtime dependency closure to Resources/node_modules so bare require() calls
// do not fall through to a developer checkout's node_modules.
// Why the single file rather than the package root: app.asar carries no node_modules, so main's
// lazy require in deferred-emoji-shortcode-dataset.ts resolves only out of Resources/node_modules,
// but emojibase-data is 49 MB of locale datasets and worktree naming reads exactly this 166 KB file.
const emojiShortcodeDatasetResource = {
  from: 'node_modules/emojibase-data/en/shortcodes/emojibase.json',
  to: 'node_modules/emojibase-data/en/shortcodes/emojibase.json'
}
const commonExtraResources = [
  relayExtraResource,
  skillFreshnessResources,
  kontextSidecarResource,
  kontextOntologyCliResource,
  ...kontextEmbeddingRuntimeResources,
  emojiShortcodeDatasetResource
]
// electron-builder replaces these defaults when `depends` is configured; retain
// Electron's loader requirements alongside Kondex's headless-host dependencies.
const debElectronRuntimeDependencies = [
  'libgtk-3-0',
  'libnotify4',
  'libnss3',
  'libxss1',
  'libxtst6',
  'xdg-utils',
  'libatspi2.0-0',
  'libuuid1',
  'libsecret-1-0'
]
const rpmElectronRuntimeDependencies = [
  'gtk3',
  'libnotify',
  'nss',
  'libXScrnSaver',
  '(libXtst or libXtst6)',
  'xdg-utils',
  'at-spi2-core',
  '(libuuid or libuuid1)'
]

// Why mirrored, not imported: this config is CJS loaded by electron-builder outside the TS build.
// Keep in sync with isMarkdownDocumentName() in src/main/ipc/markdown-documents.ts and with
// config/nsis/kondex-installer-hooks.nsh, which registers the same set on Windows.
const MARKDOWN_FILE_EXTENSIONS = ['md', 'markdown', 'mdx']

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId,
  productName: 'Kondex',
  protocols: [{ name: 'Kondex', schemes: ['kondex'] }],
  toolsets: { appimage: '1.0.3' },
  ...(localBuildVersion ? { extraMetadata: { version: localBuildVersion } } : {}),
  directories: {
    buildResources: 'resources/build'
  },
  files: [
    '!**/.vscode/*',
    // Why: these repo-only inputs are either bundled into out/ or copied via
    // extraResources. Shipping them in app.asar bloats the desktop bundle.
    '!src{,/**/*}',
    '!config{,/**/*}',
    '!docs{,/**/*}',
    '!mobile{,/**/*}',
    '!native{,/**/*}',
    '!skills{,/**/*}',
    // Why: guide/stub authoring sources are compiled into runtime artifacts; shipping
    // either source tree would duplicate content without a runtime consumer.
    '!skill-guides{,/**/*}',
    '!skill-stubs{,/**/*}',
    '!tests{,/**/*}',
    // Why: examples/ is plugin authoring documentation with no runtime consumer.
    '!examples{,/**/*}',
    // Why: pr-evidence/ is a local e2e screenshot output (ORCA_CAPTURE_EVIDENCE);
    // it is gitignored, but exclude it defensively so a stray local capture at
    // package time never bloats app.asar.
    '!pr-evidence{,/**/*}',
    // Why: local agent/tooling directories may contain worktree symlink loops;
    // they are never runtime inputs and must not be traversed by electron-builder.
    '!{.claude,.grok,.agents,.codex}{,/**/*}',
    '!{AGENTS.md,CLAUDE.md,DEVELOPING.md,bundle-size-progress.md,ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md,ORCHESTRATION_STRUCTURED_OUTPUT_DESIGN.md}',
    '!out/**/*.test.js',
    // Why: main builds with sourcemap:'hidden' for local crash diagnosis. The app never loads them (no
    // sourceMappingURL is emitted), and packing them would add ~34MB to app.asar.
    '!out/**/*.map',
    // Why: Vite's manifest is only used to project the paired web client.
    '!out/renderer/.vite{,/**/*}',
    // Why: out/electron-dev caches `pnpm dev`'s per-branch Electron.app copies (~270MB each).
    // CI never creates it, but packaging on a machine that has run dev would pack them all.
    '!out/electron-dev{,/**/*}',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!tsconfig.json',
    '!resources/skills/**',
    '!resources/kontext/**',
    // Why: the Windows CLI shim ships via extraResources to resources/bin/kondex.cmd
    // (beside the native resources/bin/kondex.exe). Packing the source tree into
    // app.asar too lets asarUnpack:['resources/**'] extract a second copy at
    // app.asar.unpacked/resources/win32/bin/kondex.cmd with no adjacent kondex.exe,
    // which fails to launch the CLI (#7351).
    '!resources/win32{,/**/*}'
  ],
  // Why: the CLI entry-point lives in out/cli/ but imports shared modules
  // from out/shared/ and local hook mutators from out/main/. These paths must be
  // unpacked so that Node's require() can resolve the cross-directory imports
  // when the CLI runs outside the asar archive.
  // Why: daemon-entry.js is forked as a separate Node.js process and must be
  // accessible on disk (not inside the asar archive) for child_process.fork().
  // Why: the CLI is compiled by tsc (not bundled), so its runtime imports
  // resolve at runtime via Node's normal module lookup. The shim launches
  // the CLI with ELECTRON_RUN_AS_NODE, which bypasses Electron's asar
  // integration — dependencies inside the asar archive are invisible to
  // require(). Unpack CLI runtime deps so they resolve from
  // app.asar.unpacked/node_modules/.
  // Why: remote runtime connections use WebSocket + E2EE from the packaged CLI
  // before the GUI process starts, so those deps need the same treatment.
  // Why: out/package.json pins compiled output to CommonJS so parent
  // package.json files with type=module cannot change the packaged CLI loader.
  asarUnpack: [
    'out/package.json',
    'out/cli/**',
    'out/shared/**',
    // Offline CLI skill installation reuses the app's filesystem transactions.
    'out/main/skills/**',
    'out/main/agent-hooks/**',
    'out/main/claude/**',
    'out/main/claude-accounts/keychain.js',
    'out/main/codex/**',
    'out/main/daemon-entry.js',
    'out/main/session-scanner-service-entry.js',
    'out/main/wsl-transcript-fs-process-entry.js',
    'out/main/plugin-host-entry.js',
    'out/main/computer-sidecar.js',
    'out/main/parcel-watcher-process-entry.js',
    'out/main/chunks/**',
    'resources/**',
    'node_modules/ws/**',
    'node_modules/tweetnacl/**',
    'node_modules/zod/**',
    'node_modules/yaml/**'
  ],
  artifactBuildCompleted: ({ file, arch }) => {
    if (file.endsWith('.AppImage')) {
      verifyStaticAppImagePackage(file, arch)
    }
  },
  afterPack: async (context) => {
    // Why: a Linux runner-image glibc bump silently shipped a node-pty pty.node
    // requiring GLIBC_2.34, crashing the app on startup on Ubuntu 20.04 (#9902).
    // Fail packaging if any bundled native binary exceeds the supported floor.
    if (context.electronPlatformName === 'linux') {
      // Why the arch is passed: symbol-version checks pass happily on a wrong-architecture binary,
      // so a cross-built slice could ship the host's pty.node and only fail at runtime.
      verifyLinuxGlibcFloor(context.appOutDir, {
        targetArch: { 1: 'x64', 3: 'arm64' }[context.arch]
      })
    }
    const resourcesDir =
      context.electronPlatformName === 'darwin'
        ? join(
            context.appOutDir,
            `${context.packager.appInfo.productFilename}.app`,
            'Contents',
            'Resources'
          )
        : join(context.appOutDir, 'resources')
    if (!existsSync(resourcesDir)) {
      throw new Error(`Missing packaged resources directory: ${resourcesDir}`)
    }
    // FpmTarget replaces this with deb/rpm while building those artifacts from the shared app tree.
    if (context.electronPlatformName === 'linux') {
      writeFileSync(join(resourcesDir, 'package-type'), 'AppImage')
    }
    stampPackagedCliVersion(resourcesDir, context.packager.appInfo.version)
    prunePackagedRuntimeNodeModules(resourcesDir, context.electronPlatformName, context.arch)
    verifyPackagedMainRuntimeDeps(resourcesDir)
    // Why: boot the packaged daemon-entry under plain Node, but only for the
    // slice matching the packaging host's arch — daemon-entry.js is JS, yet it
    // require()s the native (N-API) node-pty for the TARGET arch, which the host
    // Node cannot load cross-arch. `Arch` enum: ia32=0, x64=1, armv7l=2,
    // arm64=3, universal=4 (universal contains the host slice, so run it).
    const archEnumByNodeArch = { ia32: 0, x64: 1, armv7l: 2, arm64: 3 }
    const hostArchEnum = archEnumByNodeArch[process.arch]
    const canExecuteTargetArch = context.arch === hostArchEnum || context.arch === 4
    if (context.electronPlatformName === 'win32') {
      if (process.platform === 'win32' && canExecuteTargetArch) {
        verifyPackagedNodePtyJobOwnership(resourcesDir)
      } else {
        console.log('[verify-packaged-node-pty] skipped cross-platform or cross-arch package')
      }
    }
    verifySkillsCliRuntime(join(resourcesDir, 'app.asar.unpacked', 'out'), resourcesDir, {
      executeCommands: canExecuteTargetArch
    })
    if (!canExecuteTargetArch) {
      console.log(
        `[verify-skills-cli-runtime] skipped command probes on cross-arch slice (target ${context.arch}, host ${process.arch})`
      )
    }
    if (canExecuteTargetArch) {
      verifyPackagedDaemonEntryBoots(resourcesDir)
    } else {
      // Why: a cross-arch slice can't be booted by the host Node, but the
      // unpacked entry must still exist — its absence is a layout regression
      // regardless of arch, so only the boot is skipped, not the check.
      assertPackagedDaemonEntryExists(resourcesDir)
      console.log(
        `[verify-packaged-daemon-entry] skipped boot on cross-arch slice (target ${context.arch}, host ${process.arch})`
      )
    }
    chmodUnixCliLaunchers(resourcesDir, context.electronPlatformName)
    chmodMacServeSimHelpers(resourcesDir, context.electronPlatformName)
    for (const filename of readdirSync(resourcesDir)) {
      if (!filename.startsWith('agent-browser-')) {
        continue
      }
      // Why: the upstream package has inconsistent executable bits across
      // platform binaries (notably darwin-x64). child_process.execFile needs
      // the copied binary to be executable in packaged apps.
      chmodSync(join(resourcesDir, filename), 0o755)
    }
    if (context.electronPlatformName === 'darwin') {
      await signMacComputerUseHelper(
        join(resourcesDir, 'Kondex Computer Use.app'),
        context.packager
      )
      await signMacStandaloneHelper(
        join(resourcesDir, '..', 'MacOS', 'orca-notification-status'),
        'orca-notification-status',
        context.packager
      )
      await signMacStandaloneHelper(
        join(resourcesDir, '..', 'MacOS', 'orca-keyboard-layout'),
        'orca-keyboard-layout',
        context.packager
      )
    }
  },
  win: {
    executableName: 'Kondex',
    extraResources: [
      ...commonExtraResources,
      ...createPackagedRuntimeNodeModuleResources('win32'),
      {
        from: 'resources/win32/bin/kondex.cmd',
        to: 'bin/kondex.cmd'
      },
      {
        from: 'native/windows-cli-launcher/.build/kondex.exe',
        to: 'bin/kondex.exe'
      },
      {
        from: 'node_modules/agent-browser/bin/agent-browser-win32-x64.exe',
        to: 'agent-browser-win32-x64.exe'
      },
      {
        from: 'native/computer-use-windows/runtime.ps1',
        to: 'computer-use-windows/runtime.ps1'
      }
    ]
  },
  nsis: {
    artifactName: 'kondex-windows-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always',
    // Why: electron-builder allows one include, so the additive Markdown "Open with"
    // registration and its matching uninstall cleanup live in the same file.
    // Windows markdown association is deliberately NOT done via `fileAssociations`; see the
    // header comment in that file for why that would steal the user's default .md handler.
    include: resolve(__dirname, 'nsis', 'kondex-installer-hooks.nsh')
  },
  mac: {
    // Why rank Alternate: Kondex joins Finder's "Open With" list for Markdown without claiming
    // LSHandlerRank ownership, so whichever editor the user already prefers stays the default.
    // Why one entry per extension: app-builder-lib globs `*.${ext}`, which an array would break.
    fileAssociations: MARKDOWN_FILE_EXTENSIONS.map((ext) => ({
      ext,
      name: 'Markdown Document',
      description: 'Markdown Document',
      role: 'Editor',
      rank: 'Alternate'
    })),
    icon: 'resources/build/icon.icns',
    entitlements: 'resources/build/entitlements.mac.plist',
    entitlementsInherit: 'resources/build/entitlements.mac.plist',
    extendInfo: {
      NSAppleEventsUsageDescription:
        'Kondex allows terminal-launched developer tools to automate local apps when you request it.',
      NSBluetoothAlwaysUsageDescription:
        'Kondex allows terminal-launched developer tools to access Bluetooth devices when you request it.',
      NSBluetoothPeripheralUsageDescription:
        'Kondex allows terminal-launched developer tools to access Bluetooth devices when you request it.',
      NSCameraUsageDescription: "Application requests access to the device's camera.",
      NSLocationUsageDescription:
        'Kondex allows terminal-launched developer tools to access location when you request it.',
      NSLocalNetworkUsageDescription:
        'Kondex allows terminal-launched developer tools to discover and connect to local development servers when you request it.',
      NSMicrophoneUsageDescription: "Application requests access to the device's microphone.",
      NSAudioCaptureUsageDescription:
        'Kondex allows terminal-launched developer tools to capture desktop audio when you request it.',
      NSBonjourServices: ['_http._tcp', '_https._tcp'],
      NSDocumentsFolderUsageDescription:
        "Application requests access to the user's Documents folder.",
      NSDownloadsFolderUsageDescription:
        "Application requests access to the user's Downloads folder."
    },
    // Why: local macOS validation builds should launch without Apple signing
    // credentials. Hardened runtime + notarization stay enabled only on the
    // explicit signing path so signed artifacts remain strict while ordinary
    // local artifacts do not fail with broken ad-hoc launch behavior.
    hardenedRuntime: shouldSignMac,
    notarize: shouldSignMac,
    extraResources: [
      ...commonExtraResources,
      ...createPackagedRuntimeNodeModuleResources('darwin'),
      {
        from: 'resources/darwin/bin/kondex',
        to: 'bin/kondex'
      },
      {
        from: 'node_modules/agent-browser/bin/agent-browser-darwin-${arch}',
        to: 'agent-browser-darwin-${arch}'
      },
      {
        from: 'native/computer-use-macos/.build/release/Kondex Computer Use.app',
        to: 'Kondex Computer Use.app'
      }
    ],
    // Why: the notification-status helper must execute from Contents/MacOS —
    // on macOS 26 UNUserNotificationCenter aborts (bundleProxyForCurrentProcess
    // is nil) for executables launched out of Contents/Resources (#7929).
    extraFiles: [
      {
        from: 'native/notification-status-macos/.build/release/orca-notification-status',
        to: 'MacOS/orca-notification-status'
      },
      {
        from: 'native/keyboard-layout-macos/.build/release/orca-keyboard-layout',
        to: 'MacOS/orca-keyboard-layout'
      }
    ],
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ]
  },
  // Why: an explicitly requested signed package should fail closed if its
  // developer-owned signing setup is unavailable.
  forceCodeSigning: shouldSignMac,
  dmg: {
    artifactName: 'kondex-macos-${arch}.${ext}'
  },
  linux: {
    // Why mimeTypes and not fileAssociations: shared-mime-info already maps *.md/*.markdown to
    // text/markdown, so reusing that type puts Kondex in the Open With list without shipping a glob
    // override. A desktop entry's MimeType only adds a handler - mimeapps.list still owns the
    // default. .mdx is deliberately absent: Ubuntu 24.04's mime database maps it to
    // application/x-genesis-32x-rom, so claiming it here would need a glob override.
    mimeTypes: ['text/markdown'],
    executableName: 'kondex',
    // Why: the icns source lets electron-builder emit standard hicolor PNG
    // sizes; a single 1024px PNG is ignored by some Linux docks/launchers.
    icon: 'resources/build/icon.icns',
    desktop: {
      entry: {
        // Why: Electron reports WM_CLASS=kondex for the visible Linux window;
        // GNOME docks need an exact match to group it with kondex.desktop.
        StartupWMClass: 'kondex'
      }
    },
    extraResources: [
      ...commonExtraResources,
      ...createPackagedRuntimeNodeModuleResources('linux'),
      {
        from: 'resources/linux/bin/kondex',
        to: 'bin/kondex'
      },
      {
        from: 'node_modules/agent-browser/bin/agent-browser-linux-${arch}',
        to: 'agent-browser-linux-${arch}'
      },
      {
        from: 'native/computer-use-linux/runtime.py',
        to: 'computer-use-linux/runtime.py'
      }
    ],
    // Keep local artifacts deterministic across supported architectures.
    target: ['AppImage', 'deb', 'rpm'],
    maintainer: 'Kondex contributors',
    category: 'Utility'
  },
  appImage: {
    artifactName: 'kondex-linux-${arch}.${ext}'
  },
  deb: {
    packageName: 'kondex',
    artifactName: 'kondex_${version}_${arch}.${ext}',
    // Why: xvfb lets the bundled `kondex serve` CLI run browser panes on a headless
    // Linux host — Chromium needs a display server even for offscreen rendering,
    // and serve starts Xvfb itself when present (see ensure-virtual-display.ts).
    depends: [
      ...debElectronRuntimeDependencies,
      'python3',
      'python3-gi',
      'gir1.2-atspi-2.0',
      'at-spi2-core',
      'xdotool',
      'xclip',
      'xvfb'
    ],
    // Why: symlink the bundled CLI onto PATH at install time so `kondex serve`
    // works on a headless host. The in-app CLI registration (CliInstaller) is
    // GUI-triggered and can never run on a server, so without this the CLI is
    // unreachable from the shell on exactly the hosts that need it.
    afterInstall: 'resources/linux/packaging/after-install.sh',
    afterRemove: 'resources/linux/packaging/after-remove.sh'
  },
  rpm: {
    packageName: 'kondex',
    artifactName: 'kondex-${version}.${arch}.${ext}',
    // Why: see deb depends. RPM distros ship Xvfb as xorg-x11-server-Xvfb (there
    // is no `xvfb` package), so the name differs from the deb here.
    depends: [
      ...rpmElectronRuntimeDependencies,
      'python3',
      'python3-gobject',
      'xdotool',
      'xclip',
      'xorg-x11-server-Xvfb'
    ],
    // Why: same headless CLI-on-PATH registration as deb; rpm runs these via fpm.
    afterInstall: 'resources/linux/packaging/after-install.sh',
    afterRemove: 'resources/linux/packaging/after-remove.sh'
  },
  beforeBuild: electronBuilderNativeRebuild,
  // Why: must be true so that electron-builder rebuilds native modules
  // (node-pty) for each target architecture when producing dual-arch macOS
  // builds (x64 + arm64). With npmRebuild disabled, CI on an arm64 runner
  // packages arm64 binaries into the x64 DMG, causing "posix_spawnp failed"
  // on Intel Macs. The beforeBuild hook performs the app's targeted rebuild and
  // returns false so electron-builder does not rebuild optional cpu-features.
  npmRebuild: true,
  // Local packages are never published by electron-builder.
  publish: []
}

// Stamp the effective local build version where node-mode CLI code can read it.
function stampPackagedCliVersion(resourcesDir, version) {
  const packageJsonPath = join(resourcesDir, 'app.asar.unpacked', 'out', 'package.json')
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Missing unpacked CLI package boundary: ${packageJsonPath}`)
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  writeFileSync(packageJsonPath, `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`)
}

function chmodUnixCliLaunchers(resourcesDir, electronPlatformName) {
  if (electronPlatformName === 'win32') {
    return
  }
  for (const launcherName of ['kondex']) {
    const launcherPath = join(resourcesDir, 'bin', launcherName)
    if (!existsSync(launcherPath)) {
      continue
    }
    // Why: packaged Unix installs expose these extraResources as public shell
    // commands, and source/packager mode drift must not ship a non-executable CLI.
    chmodSync(launcherPath, 0o755)
  }
}

function chmodMacServeSimHelpers(resourcesDir, electronPlatformName) {
  if (electronPlatformName !== 'darwin') {
    return
  }
  const helperPaths = [
    join(resourcesDir, 'serve-sim', 'bin', 'serve-sim-bin'),
    join(resourcesDir, 'serve-sim', 'dist', 'simcam', 'serve-sim-camera-helper'),
    join(resourcesDir, 'node_modules', 'serve-sim', 'bin', 'serve-sim-bin'),
    join(resourcesDir, 'node_modules', 'serve-sim', 'dist', 'simcam', 'serve-sim-camera-helper')
  ]
  for (const helperPath of helperPaths) {
    if (existsSync(helperPath)) {
      chmodSync(helperPath, 0o755)
    }
  }
}

async function signMacComputerUseHelper(helperAppPath, packager) {
  if (!existsSync(helperAppPath)) {
    if (shouldSignMac) {
      throw new Error(`Missing Kondex Computer Use helper app at ${helperAppPath}`)
    }
    return
  }
  const codeSigningInfo =
    shouldSignMac && process.env.CSC_LINK && packager?.codeSigningInfo?.value
      ? await packager.codeSigningInfo.value
      : null
  const identity =
    process.env.ORCA_COMPUTER_MACOS_SIGN_IDENTITY ??
    process.env.CSC_NAME ??
    findInstalledMacSigningIdentity(codeSigningInfo?.keychainFile) ??
    (shouldSignMac ? null : '-')
  if (!identity) {
    throw new Error('Missing signing identity for Kondex Computer Use helper app')
  }
  // Why: TCC grants attach to this nested app's code identity. Sign it before
  // the outer Orca.app is sealed so production builds preserve that identity.
  execFileSync('codesign', codesignArgs(identity, helperAppPath), { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', helperAppPath], {
    stdio: 'inherit'
  })
}

async function signMacStandaloneHelper(helperPath, helperName, packager) {
  if (!existsSync(helperPath)) {
    if (shouldSignMac) {
      throw new Error(`Missing ${helperName} helper at ${helperPath}`)
    }
    return
  }
  const codeSigningInfo =
    shouldSignMac && process.env.CSC_LINK && packager?.codeSigningInfo?.value
      ? await packager.codeSigningInfo.value
      : null
  const identity =
    process.env.CSC_NAME ??
    findInstalledMacSigningIdentity(codeSigningInfo?.keychainFile) ??
    (shouldSignMac ? null : '-')
  if (!identity) {
    throw new Error(`Missing signing identity for ${helperName} helper`)
  }
  // Why: nested executables must be signed before the outer app bundle is sealed.
  const args = ['--force', '--sign', identity]
  if (shouldSignMac) {
    args.push('--options', 'runtime', '--timestamp')
  }
  args.push(helperPath)
  execFileSync('codesign', args, { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--strict', helperPath], { stdio: 'inherit' })
}

function codesignArgs(identity, targetPath) {
  const args = ['--force', '--deep', '--sign', identity]
  if (shouldSignMac) {
    args.push(
      '--options',
      'runtime',
      '--timestamp',
      '--entitlements',
      resolve(__dirname, '../resources/build/entitlements.computer-use.mac.plist')
    )
  }
  args.push(targetPath)
  return args
}

function findInstalledMacSigningIdentity(keychainFile) {
  try {
    const output = execFileSync(
      'security',
      ['find-identity', '-v', '-p', 'codesigning', ...(keychainFile ? [keychainFile] : [])],
      {
        encoding: 'utf8'
      }
    )
    const releaseMatch =
      output.match(/"([^"]*Developer ID Application:[^"]+)"/) ??
      output.match(/"([^"]*Apple Distribution:[^"]+)"/)
    if (releaseMatch?.[1]) {
      return releaseMatch[1]
    }
    if (!shouldSignMac) {
      return output.match(/"([^"]*Apple Development:[^"]+)"/)?.[1] ?? null
    }
  } catch {}
  return null
}
