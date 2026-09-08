/**
 * Realistic terminal-title corpus for pinning agent classification.
 *
 * Why a shared const: the corpus is the contract the memoized classifiers must
 * reproduce byte-for-byte, so the pinning test and the memo regression test
 * read the same titles.
 */
export const TERMINAL_TITLE_CLASSIFICATION_CORPUS: readonly string[] = [
  // Plain shell / directory titles — must classify as nothing.
  '',
  'zsh',
  'bash',
  'nwparker@mac: ~/orca',
  'npm run dev',
  // Boundary-guard cases from agent-name-token-match.ts's header comment.
  'claude-scratch',
  '~/codex/ready',
  'review-14600-codex',
  'timestamp ready',
  'android build running',
  'C:\\tools\\codex\\run',
  '/usr/local/bin/claude/notes',
  // Windows launcher suffixes.
  'codex.exe',
  'claude.bat working',
  // Claude Code prefixes and identity frames.
  '\u2733',
  '\u2733 Claude Code',
  '\u2733 ready',
  '. building the parser',
  '* done',
  'Claude Code',
  'claude - action required',
  'Claude ready',
  'claude agents',
  '"/usr/local/bin/claude" agents',
  // Leading spinner glyphs (braille + quarter circle).
  '\u280b Claude Code',
  '\u2809 Codex \u2014 refactoring',
  '\u25d0 working',
  // Named agents with status words.
  'codex working',
  'codex ready',
  'cursor position reset',
  // Wrapper/multiplexer prefixes.
  'zsh | \u280b Codex',
  'tmux | claude - action required',
  'ssh host | codex ready'
]
