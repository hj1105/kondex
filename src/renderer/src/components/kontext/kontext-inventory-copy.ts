import { translate } from '@/i18n/i18n'
export function getKontextInventoryCopy() {
  return {
    browse: translate('kondex.sourceInventory.browse', 'Browse registered sources'),
    search: translate('kondex.sourceInventory.search', 'Search loaded sources…'),
    notice: translate(
      'kondex.sourceInventory.notice',
      'Saved metadata only, not a live origin check. Select sources for this plan; selection grants no model permission or decision approval.'
    ),
    empty: translate(
      'kondex.sourceInventory.empty',
      'No matching sources loaded. Register a source above, or load another page.'
    ),
    reload: translate('kondex.sourceInventory.reload', 'Reload source list'),
    more: translate('kondex.sourceInventory.more', 'Load more sources'),
    busy: translate('kondex.sourceInventory.busy', 'Reading source metadata…'),
    error: translate(
      'kondex.sourceInventory.error',
      'Source list unavailable or changed. Reload the list; your selected IDs are unchanged. Older hosts may not support this list.'
    ),
    blocked: translate(
      'kondex.sourceInventory.blocked',
      'Recapture this source and check model permissions above before adding it.'
    ),
    allowed: translate('kondex.sourceInventory.allowed', 'Saved model permissions'),
    none: translate('kondex.sourceInventory.none', 'None'),
    limit: translate(
      'kondex.sourceInventory.limit',
      'Up to 32 required sources per plan. Remove a selection to add another.'
    )
  }
}
