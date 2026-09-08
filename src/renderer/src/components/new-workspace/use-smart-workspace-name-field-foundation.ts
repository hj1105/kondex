import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { buildTaskSourceContextFromRepo } from '../../../../shared/task-source-context'
import type {
  NormalizedSmartWorkspaceNameFieldProps,
  RepoBackedSearchTarget
} from './smart-workspace-name-field-model'
import { useSmartWorkspaceFieldAvailability } from './use-smart-workspace-field-availability'
import { useSmartWorkspaceNameFieldState } from './use-smart-workspace-name-field-state'

export function useSmartWorkspaceNameFieldFoundation(
  props: NormalizedSmartWorkspaceNameFieldProps
) {
  const {
    repos,
    repoId,
    githubSourceContext: override,
    repoBackedSearchRepos,
    textOnly,
    value
  } = props
  const store = useAppStore(
    useShallow((s) => ({
      addRepo: s.addRepo,
      fetchWorkItems: s.fetchWorkItems,
      fetchWorkItemsAcrossRepos: s.fetchWorkItemsAcrossRepos,
      getCachedWorkItems: s.getCachedWorkItems,
      preflightStatus: s.preflightStatus,
      preflightStatusChecked: s.preflightStatusChecked,
      preflightStatusContextKey: s.preflightStatusContextKey,
      expectedPreflightContextKey: localPreflightContextKey(getLocalPreflightContext(s)),
      refreshPreflightStatus: s.refreshPreflightStatus,
      settings: s.settings
    }))
  )
  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === repoId) ?? null,
    [repoId, repos]
  )
  const selectedRepoOwnerSettings = useMemo(
    () => getRepoOwnerRoutedSettings(store.settings, selectedRepo),
    [selectedRepo, store.settings]
  )
  const githubSourceContext = useMemo(() => {
    if (override?.provider === 'github') {
      return override
    }
    return selectedRepo
      ? buildTaskSourceContextFromRepo({
          provider: 'github',
          projectId: selectedRepo.id,
          repo: selectedRepo
        })
      : null
  }, [override, selectedRepo])
  const gitlabSourceContext = useMemo(
    () =>
      selectedRepo
        ? buildTaskSourceContextFromRepo({
            provider: 'gitlab',
            projectId: selectedRepo.id,
            repo: selectedRepo
          })
        : null,
    [selectedRepo]
  )
  const repoBackedSearchTargets = useMemo<RepoBackedSearchTarget[]>(
    () =>
      (repoBackedSearchRepos.length > 0
        ? repoBackedSearchRepos
        : selectedRepo
          ? [selectedRepo]
          : []
      ).map((repo) => ({
        repo,
        githubSourceContext:
          repo.id === selectedRepo?.id && githubSourceContext?.provider === 'github'
            ? githubSourceContext
            : buildTaskSourceContextFromRepo({ provider: 'github', projectId: repo.id, repo }),
        gitlabSourceContext:
          repo.id === selectedRepo?.id && gitlabSourceContext?.provider === 'gitlab'
            ? gitlabSourceContext
            : buildTaskSourceContextFromRepo({ provider: 'gitlab', projectId: repo.id, repo })
      })),
    [githubSourceContext, gitlabSourceContext, repoBackedSearchRepos, selectedRepo]
  )
  const state = useSmartWorkspaceNameFieldState(textOnly, value)
  const availability = useSmartWorkspaceFieldAvailability({
    props,
    state,
    repoBackedSearchTargets,
    preflightStatus: store.preflightStatus,
    preflightStatusChecked: store.preflightStatusChecked,
    preflightStatusContextKey: store.preflightStatusContextKey,
    expectedPreflightContextKey: store.expectedPreflightContextKey,
    refreshPreflightStatus: store.refreshPreflightStatus
  })
  return {
    ...props,
    ...state,
    ...availability,
    ...store,
    selectedRepo,
    selectedRepoOwnerSettings,
    githubSourceContext,
    repoBackedSearchTargets
  }
}
