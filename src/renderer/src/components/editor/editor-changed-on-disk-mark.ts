import type { OpenFile } from '@/store/slices/editor'
import { canAutoSaveOpenFile } from './editor-autosave'

type ChangedOnDiskMarkState = {
  setExternalMutation: (fileId: string, mutation: 'deleted' | 'renamed' | 'changed' | null) => void
}

// Why: the changed-on-disk mark has one rule — dirty, banner-capable tab. Three
// writers (the watch hook, autosave backstop, and restored-tab conflict scan)
// share it here so the rule cannot drift;
// each writer keeps its own echo/eligibility guard at the call site.
export function markFileChangedOnDisk(state: ChangedOnDiskMarkState, file: OpenFile): void {
  if (!file.isDirty || !canAutoSaveOpenFile(file)) {
    return
  }
  state.setExternalMutation(file.id, 'changed')
}
