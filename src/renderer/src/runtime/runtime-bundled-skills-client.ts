import {
  BUNDLED_SKILL_INSTALL_CAPABILITY,
  BUNDLED_SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE,
  BundledSkillInstallRequestSchema,
  type BundledSkillInstallRequest
} from '../../../shared/bundled-skill-install-contract'
import { SkillBundleInstallResultSchema } from '../../../shared/skill-bundle-install-contract'
import { callRuntimeRpc, type RuntimeClientTarget } from './runtime-rpc-client'
import { captureRuntimeEnvironmentRequestRevision } from './runtime-environment-revision'

export async function installBundledSkillsOnRuntimeTarget(
  target: RuntimeClientTarget,
  input: BundledSkillInstallRequest
) {
  const request = BundledSkillInstallRequestSchema.parse(input)
  const revision =
    target.kind === 'environment'
      ? {
          expectedEnvironmentPairingRevision: captureRuntimeEnvironmentRequestRevision(
            target.environmentId
          )
        }
      : {}
  // The web client's "local" target is also an independently updated server.
  const status = await callRuntimeRpc<{ capabilities?: string[] }>(
    target,
    'status.get',
    undefined,
    revision
  )
  if (!status.capabilities?.includes(BUNDLED_SKILL_INSTALL_CAPABILITY)) {
    throw new Error(BUNDLED_SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE)
  }
  return SkillBundleInstallResultSchema.parse(
    await callRuntimeRpc(target, 'skills.installBundled', request, {
      ...revision,
      timeoutMs: 5 * 60_000
    })
  )
}
