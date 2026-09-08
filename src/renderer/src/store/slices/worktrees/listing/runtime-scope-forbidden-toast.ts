import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { isRuntimeScopeForbiddenError } from '../../../../runtime/runtime-rpc-client'
import { RUNTIME_SCOPE_FORBIDDEN_TOAST_ID } from './worktree-slice-constants'

export function notifyRuntimeScopeForbiddenIfNeeded(error: unknown): boolean {
  if (!isRuntimeScopeForbiddenError(error)) {
    return false
  }
  toast.error(
    translate(
      'auto.store.slices.worktrees.runtimeScopeForbiddenTitle',
      'This connection has limited access'
    ),
    {
      id: RUNTIME_SCOPE_FORBIDDEN_TOAST_ID,
      description: translate(
        'auto.store.slices.worktrees.runtimeScopeForbiddenDescription',
        'Workspaces are unavailable for this restricted connection. Reconnect with a full-access link from Settings → Runtime Environments → Share this Kondex server.'
      )
    }
  )
  return true
}
