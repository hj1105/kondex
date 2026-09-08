import { RuntimeSkillInstallQueries } from './runtime-skill-install-queries'
import type { RuntimeSkillCommandSurface } from './runtime-skill-command-contract'
export type {
  RuntimeSkillCommandSurface,
  RuntimeSkillCommandHost
} from './runtime-skill-command-contract'
export { installRuntimeSkillCommandSurface } from './runtime-skill-command-contract'

export class RuntimeSkillCommands
  extends RuntimeSkillInstallQueries
  implements RuntimeSkillCommandSurface {}
