import { translate } from '@/i18n/i18n'
export function getKontextTaskInventoryCopy() {
  return {
    title: translate('kondex.taskInventory.title', 'Registered task list'),
    load: translate('kondex.taskInventory.load', 'Load task list'),
    search: translate('kondex.taskInventory.search', 'Search loaded tasks…'),
    notice: translate(
      'kondex.taskInventory.notice',
      'Saved host records, not live execution or verified completion. Opening a task does not start an agent; completion records require explicit revalidation.'
    ),
    empty: translate(
      'kondex.taskInventory.empty',
      'No matching registered tasks loaded. Create a plan or load another page.'
    ),
    more: translate('kondex.taskInventory.more', 'Load more tasks'),
    error: translate(
      'kondex.taskInventory.error',
      'Task list unavailable or changed. Reload the list; older hosts may not support it. No automatic retry was made.'
    ),
    open: translate('kondex.taskInventory.open', 'Open task'),
    schedule: translate('kondex.taskInventory.schedule', 'Saved execution'),
    unsettled: translate('kondex.taskInventory.unsettled', 'Saved unsettled / total schedules'),
    integration: translate('kondex.taskInventory.integration', 'Saved integrated commit'),
    history: translate('kondex.taskInventory.history', 'Historical completion time'),
    noSchedule: translate('kondex.taskInventory.noSchedule', 'No saved schedule')
  }
}
