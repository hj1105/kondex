import { z } from 'zod'
import {
  kontextSessionSourceListSchema,
  kontextSessionSourceRequestSchema
} from '../../../../shared/kontext-session-source-contract'
import { previewKontextNativeSessionSource } from '../../../kontext/kontext-native-session-source'
import { defineMethod } from '../core'
import { getKontextSidecarService } from '../../../kontext/kontext-sidecar-runtime'
import { kontextMarkdownSourceResultSchema } from '../../../../shared/kontext-source-contract'
import { requireStructuredHost } from './structured-agent-session-gate'

export const kontextSessionSourceMethods = [
  defineMethod({
    name: 'kontext.registerSessionSource',
    params: kontextSessionSourceRequestSchema.extend({
      expectedContentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/)
    }),
    handler: async ({ sessionId, expectedContentDigest }, context) => {
      context.signal?.throwIfAborted()
      const runtimeId = context.runtime.getRuntimeId()
      const preview = previewKontextNativeSessionSource(
        runtimeId,
        requireStructuredHost(context),
        sessionId
      )
      if (preview.contentDigest !== expectedContentDigest) {
        throw new Error('Session source changed; preview it again')
      }
      const result = kontextMarkdownSourceResultSchema.parse(
        await getKontextSidecarService(runtimeId).callTool('kontext_register_session_source', {
          origin: preview.origin,
          expectedContentDigest
        })
      )
      if (result.contentHash !== expectedContentDigest || result.title !== `Session ${sessionId}`) {
        throw new Error('Session source registration was not confirmed; inspect before retrying')
      }
      return result
    }
  }),
  defineMethod({
    name: 'kontext.listSessionSources',
    params: z.object({}),
    handler: (_request, context) => {
      context.signal?.throwIfAborted()
      const host = requireStructuredHost(context)
      return kontextSessionSourceListSchema.parse({
        runtimeId: context.runtime.getRuntimeId(),
        scope: 'readable_native_sessions',
        registrationVersion: 1,
        sessions: host.listSessionTabs()
      })
    }
  }),
  defineMethod({
    name: 'kontext.previewSessionSource',
    params: kontextSessionSourceRequestSchema,
    handler: ({ sessionId }, context) => {
      context.signal?.throwIfAborted()
      return previewKontextNativeSessionSource(
        context.runtime.getRuntimeId(),
        requireStructuredHost(context),
        sessionId
      )
    }
  })
]
