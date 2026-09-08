import { Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { translate } from '@/i18n/i18n'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'
import NewWorkspaceComposerModal from '../components/NewWorkspaceComposerModal'
import { MarkdownTemplatePicker } from '../components/editor/MarkdownTemplatePicker'
import RecentTabSwitcher from '../components/tab-bar/RecentTabSwitcher'
import { SkillFreshnessUpdateDialog } from '../components/skills/SkillFreshnessUpdateDialog'
import { ZoomOverlay } from '../components/ZoomOverlay'
import { useAppStore } from '../store'
import { useLazyModalMounts } from './use-lazy-modal-mounts'
import type { FloatingWorkspacePanelState } from './use-floating-workspace-panel'

const QuickOpen = lazy(() => import('../components/QuickOpen'))
const WorktreeJumpPalette = lazy(() => import('../components/WorktreeJumpPalette'))
const WorkspaceCleanupDialog = lazy(
  () => import('../components/workspace-cleanup/WorkspaceCleanupDialog')
)
const StatusBar = lazy(() =>
  import('../components/status-bar/StatusBar').then((module) => ({ default: module.StatusBar }))
)
const AddRepoDialog = lazy(() => import('../components/sidebar/AddRepoDialog'))
const NonGitFolderDialog = lazy(() => import('../components/sidebar/NonGitFolderDialog'))
const AddProjectFromFolderDialog = lazy(
  () => import('../components/sidebar/AddProjectFromFolderDialog')
)
const ProjectAddedDialog = lazy(() => import('../components/sidebar/ProjectAddedDialog'))
const DeleteWorktreeDialog = lazy(() => import('../components/sidebar/DeleteWorktreeDialog'))
const PreservedBranchBatchReviewModal = lazy(
  () => import('../components/sidebar/PreservedBranchBatchReviewModal')
)
const SshPassphraseDialog = lazy(() =>
  import('../components/settings/SshPassphraseDialog').then((module) => ({
    default: module.SshPassphraseDialog
  }))
)
const FloatingTerminalPanel = lazy(() =>
  import('../components/floating-terminal/FloatingTerminalPanel').then((module) => ({
    default: module.FloatingTerminalPanel
  }))
)

type BoundaryProps = {
  boundaryId: string
  resetKey?: string | number | boolean | null
  title?: string
  description?: string
  children: React.ReactNode
}

function ModalBoundary({ children, ...props }: BoundaryProps): React.JSX.Element {
  return (
    <RecoverableRenderErrorBoundary surface="modal" compact {...props}>
      {children}
    </RecoverableRenderErrorBoundary>
  )
}

function OverlayBoundary({ children, ...props }: BoundaryProps): React.JSX.Element {
  return (
    <RecoverableRenderErrorBoundary surface="overlay" compact {...props}>
      {children}
    </RecoverableRenderErrorBoundary>
  )
}

/**
 * Every overlay and modal hosted at the App root, in a fixed sibling order so stacking stays
 * stable. Each is gated so its chunk is only fetched once the surface can actually appear.
 */
export function AppRootSurfaces(props: {
  floatingWorkspace: FloatingWorkspacePanelState
}): React.JSX.Element {
  const { floatingWorkspace } = props
  const { mountedLazyModalIds, shouldMountAddRepoDialog } = useLazyModalMounts()
  const activeView = useAppStore((s) => s.activeView)
  const activeModal = useAppStore((s) => s.activeModal)
  const statusBarVisible = useAppStore((s) => s.statusBarVisible)
  const hasSshCredentialRequest = useAppStore((s) => s.sshCredentialQueue.length > 0)

  return (
    <>
      {floatingWorkspace.shouldMountPanel ? (
        <Suspense fallback={null}>
          <OverlayBoundary
            boundaryId="overlay.floating-workspace"
            resetKey={floatingWorkspace.open}
            title={translate('auto.App.1b3024bcd6', 'The floating workspace hit an error.')}
            description={translate(
              'auto.App.7cbfbf622f',
              'Retry the floating workspace or close and reopen it.'
            )}
          >
            <FloatingTerminalPanel
              open={floatingWorkspace.open}
              onOpenChange={floatingWorkspace.setOpenWithFocus}
            />
          </OverlayBoundary>
        </Suspense>
      ) : null}
      {statusBarVisible ? (
        <Suspense
          fallback={
            <div className="h-6 min-h-[24px] shrink-0 border-t border-border bg-[var(--bg-titlebar,var(--card))]" />
          }
        >
          <OverlayBoundary
            boundaryId="overlay.status-bar"
            resetKey={activeView}
            title={translate('auto.App.2e8ff36f94', 'The status bar hit an error.')}
            description={translate(
              'auto.App.8a023cea1f',
              'Retry the status bar to remount its controls.'
            )}
          >
            <StatusBar floatingTerminalOpen={floatingWorkspace.open} />
          </OverlayBoundary>
        </Suspense>
      ) : null}
      {/* Why: keep in the entry bundle so a stale/corrupt lazy chunk can't strand users at Create. */}
      {activeModal === 'new-workspace-composer' ? (
        <ModalBoundary boundaryId="modal.new-workspace-composer" resetKey>
          <NewWorkspaceComposerModal />
        </ModalBoundary>
      ) : null}
      <Suspense fallback={null}>
        {shouldMountAddRepoDialog ? (
          <ModalBoundary boundaryId="modal.add-repo" resetKey={activeModal === 'add-repo'}>
            <AddRepoDialog />
          </ModalBoundary>
        ) : null}
        {/* Why: Settings can start Add Project without Sidebar, so its handoff dialogs must share the root host. */}
        {activeModal === 'confirm-non-git-folder' ? (
          <ModalBoundary boundaryId="modal.confirm-non-git-folder" resetKey>
            <NonGitFolderDialog />
          </ModalBoundary>
        ) : null}
        {activeModal === 'confirm-add-project-from-folder' ? (
          <ModalBoundary boundaryId="modal.confirm-add-project-from-folder" resetKey>
            <AddProjectFromFolderDialog />
          </ModalBoundary>
        ) : null}
        {activeModal === 'project-added' ? (
          <ModalBoundary boundaryId="modal.project-added" resetKey>
            <ProjectAddedDialog />
          </ModalBoundary>
        ) : null}
      </Suspense>
      {/* Why: root overlays can render Radix <Tooltip>s; keep inside the shared provider so lazy surfaces mount from any entry point. */}
      <Suspense fallback={null}>
        {mountedLazyModalIds.has('workspace-cleanup') ? (
          <ModalBoundary
            boundaryId="modal.workspace-cleanup"
            resetKey={activeModal === 'workspace-cleanup'}
          >
            <WorkspaceCleanupDialog />
          </ModalBoundary>
        ) : null}
      </Suspense>
      <Suspense fallback={null}>
        {mountedLazyModalIds.has('quick-open') ? (
          <ModalBoundary boundaryId="modal.quick-open" resetKey={activeModal === 'quick-open'}>
            <QuickOpen />
          </ModalBoundary>
        ) : null}
        {mountedLazyModalIds.has('worktree-palette') ? (
          <ModalBoundary
            boundaryId="modal.worktree-palette"
            resetKey={activeModal === 'worktree-palette'}
          >
            <WorktreeJumpPalette />
          </ModalBoundary>
        ) : null}
      </Suspense>
      <OverlayBoundary boundaryId="overlay.zoom" resetKey={activeView}>
        <ZoomOverlay />
      </OverlayBoundary>
      <Suspense fallback={null}>
        {activeModal === 'delete-worktree' ? (
          <ModalBoundary boundaryId="modal.delete-worktree" resetKey>
            <DeleteWorktreeDialog />
          </ModalBoundary>
        ) : null}
        {activeModal === 'preserved-branch-review' ? (
          <ModalBoundary boundaryId="modal.preserved-branch-review" resetKey>
            <PreservedBranchBatchReviewModal />
          </ModalBoundary>
        ) : null}
      </Suspense>
      {hasSshCredentialRequest ? (
        <Suspense fallback={null}>
          <ModalBoundary boundaryId="modal.ssh-passphrase" resetKey={activeModal}>
            <SshPassphraseDialog />
          </ModalBoundary>
        </Suspense>
      ) : null}
      <ModalBoundary boundaryId="modal.markdown-template-picker" resetKey={activeModal}>
        <MarkdownTemplatePicker />
      </ModalBoundary>
      <OverlayBoundary boundaryId="overlay.recent-tab-switcher" resetKey={activeView}>
        <RecentTabSwitcher />
      </OverlayBoundary>
      {/* Why: hosts a live terminal pane needing the link-routing preference context; mounting outside crashes it. */}
      <OverlayBoundary boundaryId="overlay.skill-freshness-update-dialog">
        <SkillFreshnessUpdateDialog />
      </OverlayBoundary>
    </>
  )
}
