import { describe, expect, it } from 'vitest'
import { createDraftPasteReadyScanner } from './draft-paste-ready-scanner'

const DECSET_BRACKETED_PASTE = '\x1b[?2004h'
const SHOW_CURSOR = '\x1b[?25h'

const CODEX_PROMPT = '\x1b[1m›\x1b[0m Ask Codex to do anything'
const CODEX_DYNAMIC_PROMPT = '\x1b[1m›\x1b[0m Implement {feature}'
const ALT_SCREEN_ENTER = '\x1b[?1049h'
const ALT_SCREEN_LEAVE = '\x1b[?1049l'

describe('createDraftPasteReadyScanner', () => {
  describe('codex-composer-prompt', () => {
    it('is ready on the composer glyph after bracketed paste and never arms the quiet timer', () => {
      const scanner = createDraftPasteReadyScanner('codex-composer-prompt')
      expect(scanner.observe(DECSET_BRACKETED_PASTE)).toEqual({
        ready: false,
        armQuietTimer: false
      })
      expect(scanner.observe(CODEX_PROMPT)).toEqual({ ready: true, armQuietTimer: false })
    })

    it('detects the composer glyph inside a large first render chunk', () => {
      const scanner = createDraftPasteReadyScanner('codex-composer-prompt')
      expect(scanner.observe(`${DECSET_BRACKETED_PASTE}${CODEX_PROMPT}${'x'.repeat(900)}`)).toEqual(
        { ready: true, armQuietTimer: false }
      )
    })

    it('is ready when Codex renders its composer before enabling bracketed paste', () => {
      const scanner = createDraftPasteReadyScanner('codex-composer-prompt')
      expect(scanner.observe(`${ALT_SCREEN_ENTER}${CODEX_DYNAMIC_PROMPT}`)).toEqual({
        ready: false,
        armQuietTimer: false
      })
      expect(scanner.observe(DECSET_BRACKETED_PASTE)).toEqual({
        ready: true,
        armQuietTimer: false
      })
    })

    it('forgets a pre-anchor glyph when Codex leaves the alternate screen', () => {
      const scanner = createDraftPasteReadyScanner('codex-composer-prompt')
      scanner.observe(`${ALT_SCREEN_ENTER}${CODEX_DYNAMIC_PROMPT}${ALT_SCREEN_LEAVE}`)
      expect(scanner.observe(DECSET_BRACKETED_PASTE)).toEqual({
        ready: false,
        armQuietTimer: false
      })
    })

    it('ignores a stale shell glyph before bracketed paste is enabled', () => {
      const scanner = createDraftPasteReadyScanner('codex-composer-prompt')
      expect(scanner.observe('› codex\r\nstartup output')).toEqual({
        ready: false,
        armQuietTimer: false
      })
      expect(scanner.observe(DECSET_BRACKETED_PASTE)).toEqual({
        ready: false,
        armQuietTimer: false
      })
    })

    it('never arms the quiet-window fallback', () => {
      const scanner = createDraftPasteReadyScanner('codex-composer-prompt')
      expect(scanner.observe(DECSET_BRACKETED_PASTE)).toEqual({
        ready: false,
        armQuietTimer: false
      })
      expect(scanner.observe('noise')).toEqual({ ready: false, armQuietTimer: false })
    })
  })

  describe('render-quiet-after-bracketed-paste (default)', () => {
    it('arms the quiet timer after bracketed paste and never reports a signal', () => {
      const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste')
      expect(scanner.observe(DECSET_BRACKETED_PASTE)).toEqual({ ready: false, armQuietTimer: true })
      // Show-cursor is not a signal for the default path; it just keeps arming.
      expect(scanner.observe(SHOW_CURSOR)).toEqual({ ready: false, armQuietTimer: true })
    })

    it('does nothing until bracketed paste is enabled', () => {
      const scanner = createDraftPasteReadyScanner('render-quiet-after-bracketed-paste')
      expect(scanner.observe('pre-handshake output')).toEqual({
        ready: false,
        armQuietTimer: false
      })
    })
  })
})
