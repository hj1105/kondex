import type { PreloadApi } from '../../../../preload/api-types'
import {
  DEFAULT_LOCAL_ORCA_PROFILE_ID,
  createDefaultLocalOrcaProfile
} from '../../../../shared/orca-profiles'

export function createWebOrcaProfilesApi(): Partial<PreloadApi> {
  return {
    orcaProfiles: {
      list: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_ORCA_PROFILE_ID,
          profiles: [createDefaultLocalOrcaProfile(0)],
          multiProfileUi: false
        }),
      createLocal: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_ORCA_PROFILE_ID,
          profiles: [createDefaultLocalOrcaProfile(0)],
          profile: createDefaultLocalOrcaProfile(0)
        }),
      switchProfile: () => Promise.resolve({ status: 'already-active' }),
      transferProject: (args) =>
        Promise.resolve({
          status: 'duplicate-target',
          sourceProfileId: args.sourceProfileId,
          targetProfileId: args.targetProfileId,
          sourceRepoId: args.repoId,
          duplicateRepoId: args.repoId
        }),
      findProjectProfiles: async () => ({ projects: [] })
    }
  }
}
