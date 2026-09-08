import fs from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import ts from 'typescript-api'
import { LOCALE_KEY_OVERRIDES } from './locale-key-overrides.mjs'
import {
  collectLocalizationKeyReferences,
  collectSourceFiles,
  LOCALIZATION_SOURCE_ROOTS
} from './verify-localization-catalog.mjs'

const root = path.resolve(import.meta.dirname, '../..')
let references = []

const RUNTIME_COPY_FILES = [
  'src/main/app-icon.ts',
  'src/main/automations/dispatch-refusal.ts',
  'src/main/automations/run-completion-watcher.ts',
  'src/main/automations/run-target-resolution.ts',
  'src/main/automations/run-usage-collection.ts',
  'src/main/automations/runtime-terminal-run-observer.ts',
  'src/main/automations/service.ts',
  'src/main/browser/browser-cookie-chromium-scan.ts',
  'src/main/browser/browser-cookie-import-pipeline.ts',
  'src/main/browser/browser-cookie-safari-import.ts',
  'src/main/browser/browser-manager-registration.ts',
  'src/main/browser/cdp-bridge-state.ts',
  'src/main/browser/cdp-page-navigation-commands.ts',
  'src/main/browser/doc-preview-file-reader.ts',
  'src/main/claude-accounts/claude-account-registration.ts',
  'src/main/claude-accounts/claude-managed-auth-storage.ts',
  'src/main/claude-accounts/managed-auth-path.ts',
  'src/main/claude-accounts/runtime-auth/runtime-auth-managed-credentials.ts',
  'src/main/codex/codex-legacy-session-resume.ts',
  'src/main/codex/codex-real-home-hooks-json.ts',
  'src/main/codex/codex-server-request-disposition.ts',
  'src/main/codex/codex-structured-provider-events.ts',
  'src/main/codex/codex-unverified-resume-launch.ts',
  'src/main/codex-accounts/codex-account-registration.ts',
  'src/main/codex-accounts/codex-config-mirror.ts',
  'src/main/codex-accounts/codex-managed-home-path.ts',
  'src/main/codex-accounts/host-codex-managed-home-ownership.ts',
  'src/main/computer/computer-provider-unavailable-message.ts',
  'src/main/crash-reporting/gpu-fallback-recovered-launch.ts',
  'src/main/crash-reporting/gpu-fallback-restart-prompt.ts',
  'src/main/daemon/node-pty-error-hints.ts',
  'src/main/daemon/pty-subprocess/spawn-preflight.ts',
  'src/main/github/project-view/project-view-table.ts',
  'src/main/github/stacked-pr-creation.ts',
  'src/main/host/electron-secret-store.ts',
  'src/main/ipc/ai-vault-runtime-scan.ts',
  'src/main/ipc/notification-options.ts',
  'src/main/ipc/notification-permission-probe.ts',
  'src/main/ipc/runtime-environment-pairing-verification.ts',
  'src/main/ipc/startup-notification-registration.ts',
  'src/main/ipc/worktree-remote.ts',
  'src/main/localhost-worktree-label-proxy.ts',
  'src/main/native-chat/agent-session-journal/journal-payload-bounds.ts',
  'src/main/native-chat/agent-session-wire/agent-session-delta-coalescer.ts',
  'src/main/native-chat/agent-session-wire/agent-session-history-page-bounds.ts',
  'src/main/native-chat/agent-session-wire/structured-agent-session-refusal-message.ts',
  'src/main/native-chat/wsl-transcript-fs-error.ts',
  'src/main/ports/workspace-port-ownership.ts',
  'src/main/providers/ssh-git-provider.ts',
  'src/main/providers/ssh-git-read-provider.ts',
  'src/main/providers/ssh-git-review-head-provider.ts',
  'src/main/providers/ssh-git-worktree-provider.ts',
  'src/main/runtime/orca-runtime-core.ts',
  'src/main/runtime/orchestration/db/messages/message-inbox.ts',
  'src/main/runtime/orchestration/federation-sync.ts',
  'src/main/runtime/rpc/methods/accounts.ts',
  'src/main/runtime/rpc/methods/agent-hooks.ts',
  'src/main/runtime/rpc/methods/orchestration-federation.ts',
  'src/main/runtime/rpc/methods/orchestration-inject-rejection-message.ts',
  'src/main/runtime/rpc/methods/orchestration-run-scope.ts',
  'src/main/runtime/rpc/methods/orchestration-schemas.ts',
  'src/main/runtime/rpc/methods/orchestration-send-control-mail.ts',
  'src/main/runtime/rpc/methods/orchestration-worker-observation.ts',
  'src/main/runtime/runtime-file-commands-mobile-file-list-limit.ts',
  'src/main/runtime/runtime-rpc/runtime-rpc-pairing-types.ts',
  'src/main/runtime/runtime-worktree-lineage-recording.ts',
  'src/main/runtime/runtime-worktree-lineage-resolution.ts',
  'src/main/runtime/ssh-file-explorer-chunk-read.ts',
  'src/main/source-control/hosted-review-creation.ts',
  'src/main/ssh/build-toolchain-diagnosis.ts',
  'src/main/ssh/sftp-stream-late-error.ts',
  'src/main/ssh/ssh-relay-deploy.ts',
  'src/main/ssh/ssh-relay-endpoint-incumbent.ts',
  'src/main/ssh/ssh-relay-session.ts',
  'src/main/ssh/ssh-relay-upload-stage-commands.ts',
  'src/main/ssh/ssh-relay-upload-stage-windows-commands.ts',
  'src/main/ssh/ssh-relay-versioned-install.ts',
  'src/main/ssh/ssh-remote-cli-host-passthrough.ts',
  'src/main/ssh/ssh-remote-node-install-guidance.ts',
  'src/main/ssh/ssh-remote-node-resolution.ts',
  'src/main/ssh/ssh-remote-orca-cli.ts',
  'src/main/ssh/ssh-remote-orchestration-send.ts',
  'src/main/ssh/ssh-remote-powershell.ts',
  'src/main/startup/cli-launch-redirect.ts',
  'src/main/startup/ensure-virtual-display.ts',
  'src/main/startup/single-instance-lock.ts',
  'src/main/startup/windows-install-dir-acl-recovery.ts',
  'src/main/text-generation/source-control-agent-failure.ts',
  'src/main/window/dashboard-popout-window.ts',
  'src/main/window/main-window-close-lifecycle.ts',
  'src/main/window/renderer-recovery-prompt.ts',
  'src/main/cli/appimage-registration-lock.ts',
  'src/main/cli/appimage-stable-launcher.ts',
  'src/main/cli/cli-command-filesystem-transaction.ts',
  'src/main/cli/cli-command-inspection.ts',
  'src/main/cli/cli-command-installation.ts',
  'src/main/cli/cli-installer.ts',
  'src/main/cli/cli-path-registration.ts',
  'src/main/cli/legacy-appimage-cli-wrapper.ts',
  'src/main/cli/windows-user-path-registry.ts',
  'src/main/cli/wsl-cli-installer.ts',
  'src/renderer/src/components/automations/automation-capability-probe.ts',
  'src/renderer/src/components/pr-comments-resolution-prompt.ts',
  'src/renderer/src/components/right-sidebar/checks-panel-blocker-copy.ts',
  'src/renderer/src/components/right-sidebar/checks-panel-review-copy.ts',
  'src/renderer/src/components/right-sidebar/source-control-create-review-blocked-action.ts',
  'src/renderer/src/components/settings/repository-source-control-ai-labels.ts',
  'src/renderer/src/components/tab-group/AiVaultSessionDropLayer.tsx',
  'src/renderer/src/components/terminal-pane/codex-backfill-error-detector.ts',
  'src/renderer/src/components/terminal-pane/pty-connection/hidden-output-restore-limits.ts',
  'src/renderer/src/components/terminal-pane/pty-connection/startup-cwd-fallback-notice.ts',
  'src/renderer/src/hooks/useSkillFreshness.ts',
  'src/renderer/src/lib/active-agent-note-send-result.ts',
  'src/renderer/src/lib/agent-session-continuation.ts',
  'src/renderer/src/lib/agent-session-fork-context.ts',
  'src/renderer/src/lib/file-preview.ts',
  'src/renderer/src/lib/migration-unsupported-agent-entry.ts',
  'src/renderer/src/lib/pane-manager/pane-terminal-output-queue-registry.ts',
  'src/renderer/src/lib/project-host-setup-options.ts',
  'src/renderer/src/lib/remote-pairing-copy.ts',
  'src/renderer/src/lib/source-control-agent-action-plan.ts',
  'src/renderer/src/lib/source-control-generation-plan.ts',
  'src/renderer/src/runtime/remote-runtime-terminal-multiplexer-base.ts',
  'src/renderer/src/runtime/runtime-file-read-client.ts',
  'src/renderer/src/runtime/runtime-file-search-client.ts',
  'src/renderer/src/store/project-groups/project-group-mutations.ts',
  'src/renderer/src/store/projects/project-host-routing.ts',
  'src/renderer/src/store/slices/terminal-quick-command-hosts.ts',
  'src/renderer/src/web/WebConnect.tsx',
  'src/renderer/src/web/main.tsx',
  'src/renderer/src/web/preload-api/web-app-api.ts',
  'src/renderer/src/web/preload-api/web-host-capability-api.ts',
  'src/renderer/src/web/preload-api/web-runtime-environments-api.ts',
  'src/renderer/src/web/preload-api/web-runtime-session.ts',
  'src/renderer/src/web/web-runtime-client.ts',
  'src/renderer/src/web/web-runtime-connection-transport.ts',
  'src/renderer/src/web/web-runtime-connection-waiters.ts',
  'src/renderer/src/web/web-runtime-environment.ts',
  'src/renderer/src/web/web-runtime-request-registry.ts'
]

beforeAll(async () => {
  const files = (
    await Promise.all(
      LOCALIZATION_SOURCE_ROOTS.map((dir) => collectSourceFiles(root, path.join(root, dir)))
    )
  ).flat()
  references = (
    await Promise.all(
      files.map(async (file) =>
        collectLocalizationKeyReferences(file, await fs.readFile(file, 'utf8'), root)
      )
    )
  ).flat()
})

describe('Kondex public identity', () => {
  it('names the product in reviewed runtime and CLI copy', async () => {
    const failures = []
    for (const file of RUNTIME_COPY_FILES) {
      const source = await fs.readFile(path.join(root, file), 'utf8')
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
      const visit = (node) => {
        if (
          (ts.isStringLiteralLike(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node) ||
            ts.isJsxText(node)) &&
          /\bOrca\b/.test(node.text)
        ) {
          failures.push({
            file,
            line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
          })
        }
        ts.forEachChild(node, visit)
      }
      visit(ast)
    }
    expect(failures).toEqual([])
  })

  it('does not restore the upstream app name through translation overrides', () => {
    const keys = new Set(
      references.filter((ref) => /\bKondex\b/.test(ref.fallback ?? '')).map((ref) => ref.key)
    )
    const failures = []
    for (const key of keys) {
      for (const [locale, value] of Object.entries(LOCALE_KEY_OVERRIDES[key] ?? {})) {
        if (/\bOrca\b/.test(value)) {
          failures.push({ key, locale })
        }
      }
    }
    expect(failures).toEqual([])
  })

  it('uses the product name in static app copy', () => {
    expect(
      references
        .filter((ref) => /\bOrca\b/.test(ref.fallback ?? ''))
        .map(({ filePath, line, key }) => ({ filePath, line, key }))
    ).toEqual([])
  })

  it.each(['en', 'es', 'fr', 'ja', 'ko', 'zh'])(
    '%s does not restore the upstream name for app copy',
    async (locale) => {
      const catalog = JSON.parse(
        await fs.readFile(
          path.join(root, 'src/renderer/src/i18n/locales', `${locale}.json`),
          'utf8'
        )
      )
      const keys = new Set(
        references.filter((ref) => /\bKondex\b/.test(ref.fallback ?? '')).map((ref) => ref.key)
      )
      const failures = []
      for (const key of keys) {
        const value = key.split('.').reduce((node, part) => node?.[part], catalog)
        if (typeof value === 'string' && /\bOrca\b/.test(value)) {
          failures.push(key)
        }
      }
      expect(failures).toEqual([])
    }
  )
})
