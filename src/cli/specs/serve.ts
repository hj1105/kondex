import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SERVE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['serve'],
    summary: 'Start a Kondex runtime server without opening a desktop window',
    usage: 'kondex serve [--port <port>] [--pairing-address <host>] [--no-pairing] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'port', 'pairing-address', 'no-pairing'],
    notes: [
      'Runs in the foreground and prints the bound endpoint, advertised endpoint, and pairing status. Stop it with Ctrl+C.',
      '--pairing-address changes only the client-advertised address; use a reachable LAN, Tailscale, SSH-forward, or reverse-proxy endpoint.',
      'When the web client bundle is available, the server also prints a browser URL with the pairing data embedded.'
    ],
    examples: [
      'kondex serve',
      'kondex serve --json',
      'kondex serve --port 6768 --pairing-address 100.64.1.20'
    ]
  }
]
