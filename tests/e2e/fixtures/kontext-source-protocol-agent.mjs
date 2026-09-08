import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'

const binary = process.argv[1]
const profile = path.dirname(path.dirname(binary))
if (!path.basename(profile).startsWith('orca-e2e-restart-')) {
  throw new Error('Source protocol fixture requires an isolated restart profile')
}
const record = (entry) =>
  appendFileSync(path.join(profile, 'provider-protocol.jsonl'), `${JSON.stringify(entry)}\n`)
const provider = path.basename(binary)
const args = process.argv.slice(2)
record({ kind: 'launch', provider, args })
if (provider !== 'codex' || args.length !== 1 || args[0] !== 'app-server') {
  record({ kind: 'forbidden', reason: 'Unexpected provider launch' })
  process.exit(97)
}
// Startup hook inspection is not a model session; refuse every other protocol path.
createInterface({ input: process.stdin })
  .on('line', (line) => {
    const request = JSON.parse(line)
    record({ kind: 'request', method: request.method })
    if (request.method === 'initialize' && request.params?.capabilities === undefined) {
      process.stdout.write(`${JSON.stringify({ id: request.id, result: {} })}\n`)
    } else if (request.method === 'initialized') {
      // Notification needs no response.
    } else if (request.method === 'hooks/list') {
      process.stdout.write(`${JSON.stringify({ id: request.id, result: { data: [] } })}\n`)
    } else {
      record({ kind: 'forbidden', reason: 'Unexpected protocol request', method: request.method })
      process.exit(97)
    }
  })
  .on('close', () => process.exit(0))
setTimeout(() => process.exit(97), 5000).unref()
