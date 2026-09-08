import { appendFile, readFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const claude = path.basename(process.argv[1]) === 'claude'
if (args[0] === '--version') {
  process.stdout.write(claude ? 'Claude fixture 1\n' : 'Codex fixture 1\n')
} else if (args.join(' ') === 'login status') {
  process.stdout.write('Logged in using ChatGPT\n')
} else if (args.join(' ') === 'auth status --json') {
  process.stdout.write(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }))
} else {
  if (
    claude
      ? args[0] !== '-p' || !args.includes('plan')
      : args[0] !== 'exec' || !args.includes('read-only')
  ) {
    throw new Error('Fixture refuses non-planning commands')
  }
  let prompt = ''
  for await (const chunk of process.stdin) {
    prompt += chunk
  }
  if (
    !prompt.includes('E2E only: implement total') ||
    !prompt.includes('Established total term') ||
    !prompt.includes('ontologyNodeIds')
  ) {
    throw new Error('Fixture requires the real goal and source-owned planning context')
  }
  const expectedValue = /expected working value (\d+)/.exec(prompt)?.[1]
  if (
    !expectedValue ||
    !(await readFile(path.join(process.cwd(), 'index.ts'), 'utf8')).includes(
      `return ${expectedValue};`
    )
  ) {
    throw new Error('Fixture requires the actual reviewed working-file baseline')
  }
  await appendFile(
    path.join(process.env.KONTEXT_PLUGIN_DATA, 'planning-fixture-invocations.jsonl'),
    `${JSON.stringify({ provider: claude ? 'claude' : 'codex' })}\n`
  )
  const refining = prompt.includes('Refine this unapproved draft')
  if (
    refining &&
    (!prompt.includes('User feedback: "Preserve zero and rounding boundaries"') ||
      !prompt.includes('Compute total using the established term'))
  ) {
    throw new Error('Fixture requires exact feedback and the prior proposal')
  }
  const output = JSON.stringify({
    contract: {
      intent: 'Implement total',
      risk: 'low',
      targets: ['planned:total'],
      nonGoals: [
        'Do not rename total',
        ...(refining ? ['Preserve zero and rounding boundaries'] : [])
      ],
      acceptance: [
        {
          criterionId: 'total',
          statement: 'Correct total behavior',
          verifier: { kind: 'test', ref: 'workspace:test' }
        }
      ]
    },
    logicPlans: [
      {
        workItemId: 'logic:total',
        plannedSymbolIds: ['planned:total'],
        allowedPaths: ['index.ts'],
        dependsOn: [],
        requiredVerifiers: [{ kind: 'typecheck', ref: 'workspace:typecheck' }],
        plannedSymbols: [
          {
            plannedSymbolId: 'planned:total',
            intendedIdentity: {
              relativePath: 'index.ts',
              qualifiedName: 'total',
              kind: 'function'
            },
            responsibility: 'Compute total using the established term'
          }
        ]
      }
    ]
  })
  process.stdout.write(
    claude
      ? JSON.stringify({ subtype: 'success', result: output })
      : [
          JSON.stringify({ type: 'thread.started', thread_id: 'fixture-planning-session' }),
          JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: output } }),
          JSON.stringify({ type: 'turn.completed' })
        ].join('\n')
  )
}
