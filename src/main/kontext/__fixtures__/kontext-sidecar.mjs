import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'kondex-kontext-test', version: '1.0.0' })
let callCount = 0
for (const name of [
  'kontext_list_sources',
  'kontext_create_task',
  'kontext_start_plan',
  'kontext_refine_plan',
  'kontext_inspect_plan',
  'kontext_cancel_plan',
  'kontext_approve_plan',
  'kontext_register_markdown_source',
  'kontext_register_session_source',
  'kontext_inspect_source',
  'kontext_refresh_source',
  'kontext_set_source_sharing'
]) {
  server.tool(name, { hostToken: z.string() }, async ({ hostToken }) => ({
    content: [],
    structuredContent: {
      authorized:
        /^[a-f0-9]{64}$/.test(hostToken) && hostToken === process.env.KONTEXT_HOST_MANAGEMENT_TOKEN
    }
  }))
}

server.tool('kontext_inspect_runtimes', async () => {
  callCount += 1
  const structuredContent = {
    pid: process.pid,
    callCount,
    dataDirectory: process.env.KONTEXT_PLUGIN_DATA ?? null,
    electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE ?? null,
    marker: process.env.KONTEXT_SIDECAR_TEST_MARKER ?? null
  }
  return {
    content: [{ type: 'text', text: JSON.stringify({ source: 'text-fallback' }) }],
    structuredContent
  }
})

server.tool('kontext_get_schedule', async () => ({
  content: [{ type: 'text', text: JSON.stringify({ source: 'text-only' }) }]
}))

await server.connect(new StdioServerTransport())
