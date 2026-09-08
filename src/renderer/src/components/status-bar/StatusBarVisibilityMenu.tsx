import { Activity, Plug, Server } from 'lucide-react'
import React from 'react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ClaudeIcon, OpenAIIcon } from './icons'
import { translate } from '@/i18n/i18n'
import { isStatusBarItemAvailable } from './status-bar-agent-gating'
import type { StatusBarController } from './use-status-bar-controller'

export function StatusBarVisibilityMenu({
  controller
}: {
  controller: StatusBarController
}): React.JSX.Element {
  const {
    detectedAgentIds,
    menuOpen,
    menuPoint,
    setMenuOpen,
    statusBarItems,
    toggleStatusBarItem
  } = controller

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute size-px opacity-0"
          style={{ left: menuPoint.x, top: menuPoint.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-0 w-fit" sideOffset={0} align="start">
        {isStatusBarItemAvailable('claude', detectedAgentIds) && (
          <DropdownMenuCheckboxItem
            checked={statusBarItems.includes('claude')}
            onCheckedChange={() => {
              toggleStatusBarItem('claude')
            }}
          >
            <ClaudeIcon size={14} />
            {translate('auto.components.status.bar.StatusBar.3885eb74d8', 'Claude Usage')}
          </DropdownMenuCheckboxItem>
        )}
        {isStatusBarItemAvailable('codex', detectedAgentIds) && (
          <DropdownMenuCheckboxItem
            checked={statusBarItems.includes('codex')}
            onCheckedChange={() => {
              toggleStatusBarItem('codex')
            }}
          >
            <OpenAIIcon size={14} />
            {translate('auto.components.status.bar.StatusBar.c0909c686e', 'Codex Usage')}
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('ssh')}
          onCheckedChange={() => {
            toggleStatusBarItem('ssh')
          }}
        >
          <Server className="size-3.5" />
          {translate('auto.components.status.bar.StatusBar.24ac89df1a', 'Remote Hosts')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('resource-usage')}
          onCheckedChange={() => {
            toggleStatusBarItem('resource-usage')
          }}
        >
          <Activity className="size-3.5" />
          {translate('auto.components.status.bar.StatusBar.d1e1a7a6bf', 'Resource Manager')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusBarItems.includes('ports')}
          onCheckedChange={() => {
            toggleStatusBarItem('ports')
          }}
        >
          <Plug className="size-3.5" />
          {translate('auto.components.status.bar.StatusBar.9659e38343', 'Ports')}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
