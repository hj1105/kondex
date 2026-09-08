import type { SkillDiscoveryResult, SkillDiscoveryTarget } from '../../shared/skills'
import type {
  SkillFreshnessInventory,
  SkillUpdateRun,
  SkillUpdateStartResult
} from '../../shared/skill-freshness'

import type {
  SkillDeletePlan,
  SkillDeleteRequest,
  SkillDeleteResult
} from '../../shared/skill-delete-contract'

export type SkillsApi = {
  discover: (target?: SkillDiscoveryTarget) => Promise<SkillDiscoveryResult>
  freshnessInventory: () => Promise<SkillFreshnessInventory>
  startUpdateRun: (names: string[]) => Promise<SkillUpdateStartResult>
  cancelUpdateRun: () => Promise<void>
  acknowledgeUpdateRun: () => Promise<void>
  getUpdateRun: () => Promise<SkillUpdateRun>
  /** Whether the host answering `previewDelete`/`delete` supports them. Always
   *  true on desktop; on web the "local" host is a remote server that updates
   *  independently and may predate the capability. */
  deleteSupported: () => Promise<boolean>
  previewDelete: (request: SkillDeleteRequest) => Promise<SkillDeletePlan>
  delete: (request: SkillDeleteRequest) => Promise<SkillDeleteResult>
  onUpdateRun: (callback: (run: SkillUpdateRun) => void) => () => void
}
