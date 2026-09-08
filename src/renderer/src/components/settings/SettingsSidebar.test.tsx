// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { Bot, Globe, Network, Puzzle, Terminal } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { SettingsSidebar } from './SettingsSidebar'
import { TooltipProvider } from '../ui/tooltip'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

vi.mock('@/hooks/useShortcutLabel', () => ({
  useShortcutLabel: () => '⌘F',
  useShortcutKeyComboDetails: () => [{ keys: ['⌘', 'F'], doubleTap: false }]
}))

function renderSidebar(
  activeSectionId = 'orchestration',
  settings: GlobalSettings = getDefaultSettings('/tmp')
): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <SettingsSidebar
        activeSectionId={activeSectionId}
        settings={settings}
        generalGroups={[
          {
            id: 'capabilities',
            title: 'AI Capabilities',
            sections: [
              {
                id: 'agents',
                title: 'Agents',
                icon: Bot
              },
              {
                id: 'orchestration',
                title: 'Orchestration',
                icon: Network,
                installStatus: 'install'
              },
              {
                id: 'browser',
                title: 'Browser',
                icon: Globe,
                installStatus: 'installed'
              },
              {
                id: 'computer-use',
                title: 'Computer Use',
                icon: Bot,
                installStatus: 'up-to-date'
              },
              {
                id: 'browser-loading',
                title: 'Browser Loading',
                icon: Globe,
                installStatus: 'checking'
              },
              {
                id: 'cli',
                title: 'CLI',
                icon: Terminal,
                installStatus: 'update-available'
              },
              {
                id: 'cli-review',
                title: 'CLI Review',
                icon: Terminal,
                installStatus: 'needs-attention'
              },
              {
                id: 'plugins',
                title: 'Plugins',
                icon: Puzzle
              }
            ]
          },
          {
            id: 'setup',
            title: 'Set Up',
            sections: [
              {
                id: 'accounts',
                title: 'AI Provider Accounts',
                icon: Bot,
                badge: 'Optional'
              }
            ]
          }
        ]}
        repoSections={[]}
        hasRepos={false}
        onBack={vi.fn()}
        onSelectSection={vi.fn()}
      />
    </TooltipProvider>
  )
}

describe('SettingsSidebar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('applies left sidebar appearance styles to the settings navigation', () => {
    const markup = renderSidebar('orchestration', {
      ...getDefaultSettings('/tmp'),
      leftSidebarAppearanceMode: 'match-terminal',
      terminalColorOverrides: {
        background: '#101820',
        foreground: '#f0f4f8'
      }
    })

    expect(markup).toContain('--worktree-sidebar:#101820')
    expect(markup).toContain('--worktree-sidebar-foreground:#f0f4f8')
  })

  it('reserves install state labels for actionable skill states', () => {
    const markup = renderSidebar()

    expect(markup).not.toContain('Not installed')
    expect(markup).not.toContain('Installed')
    expect(markup).not.toContain('Up to date')
    expect(markup).not.toContain('Checking...')
    expect(markup).toContain('Update available')
    expect(markup).toContain('Review skill')
    expect(markup).toContain('Optional')
  })
})
