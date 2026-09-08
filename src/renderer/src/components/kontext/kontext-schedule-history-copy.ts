import { translate } from '@/i18n/i18n'
export function getKontextScheduleHistoryCopy() {
  return {
    title: translate('kondex.scheduleHistory.title', 'Execution history'),
    load: translate('kondex.scheduleHistory.load', 'Load execution history'),
    search: translate('kondex.scheduleHistory.search', 'Search loaded executions…'),
    notice: translate(
      'kondex.scheduleHistory.notice',
      'Saved records for this task, newest first. Selecting a record does not inspect, resume or integrate it.'
    ),
    empty: translate(
      'kondex.scheduleHistory.empty',
      'No matching executions loaded. Reload or load another page.'
    ),
    more: translate('kondex.scheduleHistory.more', 'Load more executions'),
    error: translate(
      'kondex.scheduleHistory.error',
      'Execution history unavailable or changed. Reload the first page; older hosts may not support it.'
    ),
    open: translate('kondex.scheduleHistory.open', 'Select execution')
  }
}
