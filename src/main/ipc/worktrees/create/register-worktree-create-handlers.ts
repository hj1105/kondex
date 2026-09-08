import { ipcMain } from 'electron'
import type {
  CreateWorktreeArgs,
  CreateWorktreeResult
} from '../../../../shared/worktree/create-types'
import {
  addWorktreeCreatePhaseAttributes,
  withWorktreeSpan
} from '../../../observability/instrumentation'
import {
  resolveAutomationWorkspaceProvenance,
  releaseAutomationWorkspaceProvenanceRequest,
  finishAutomationWorkspaceProvenanceRequest
} from '../../../automations/workspace-provenance'
import { isFolderRepo } from '../../../../shared/repo-kind'
import {
  createRemoteWorktree,
  createLocalWorktree,
  notifyWorktreesChanged
} from '../../worktree-remote'
import { normalizeLinkedWorkItemFields } from '../ipc-context-schemas'
import type { CreateWorktreeArgsWithSystemProvenance } from '../ipc-context-schemas'
import { createFolderWorkspace } from './folder-workspace-creation'
import { requireWorktreeCreateRoute } from '../../../worktree-create-execution-host-route'
import type { WorktreeIpcContext } from '../worktree-ipc-context'

export function registerWorktreeCreateHandlers(context: WorktreeIpcContext): void {
  const { mainWindow, store, runtime, options } = context

  ipcMain.handle(
    'worktrees:create',
    async (_event, rawArgs: CreateWorktreeArgs): Promise<CreateWorktreeResult> => {
      const args = normalizeLinkedWorkItemFields(rawArgs)
      // Why span here: parent the child git spans for the trace tree; don't attach branch name/remote URL (user content) — repo ID is the safer correlator.
      return withWorktreeSpan({ stage: 'create' }, async (span) => {
        const repo = store.getRepo(args.repoId)
        if (!repo) {
          throw new Error(`Repo not found: ${args.repoId}`)
        }

        const automationProvenance = resolveAutomationWorkspaceProvenance({
          authority: runtime,
          repoSelector: args.repoId,
          repo,
          request: args.automationProvenanceRequest
        })
        const createArgs: CreateWorktreeArgsWithSystemProvenance = {
          ...args,
          automationProvenance
        }

        let result: CreateWorktreeResult
        try {
          // Why: wrap only the helpers; the pre-validation throws above are IPC-shape bugs, not the git/filesystem failures the funnel tracks.
          if (isFolderRepo(repo)) {
            // A folder workspace is a registration, not a filesystem create, so it is host-agnostic.
            result = createFolderWorkspace(createArgs, repo, store)
          } else {
            // Resolve the host rather than reading the raw field: an `executionHostId: 'ssh:*'`-only
            // row read as local here and ran `git worktree add` on the client against a remote path,
            // while the runtime sibling on the same repo already resolved.
            const createRoute = requireWorktreeCreateRoute(repo)
            result =
              createRoute.kind === 'ssh'
                ? await createRemoteWorktree(createArgs, createRoute.repo, store, mainWindow)
                : await createLocalWorktree(createArgs, repo, store, mainWindow, runtime)
          }
        } catch (error) {
          releaseAutomationWorkspaceProvenanceRequest(args.automationProvenanceRequest)
          throw error
        }
        finishAutomationWorkspaceProvenanceRequest(args.automationProvenanceRequest)
        if (result.timing) {
          addWorktreeCreatePhaseAttributes(span, result.timing)
        }

        if (isFolderRepo(repo)) {
          notifyWorktreesChanged(mainWindow, repo.id)
        }

        options?.onWorktreeLifecycle?.({
          kind: 'created',
          worktreeId: result.worktree.id,
          path: result.worktree.path,
          branch: result.worktree.branch
        })

        return result
      })
    }
  )
}
