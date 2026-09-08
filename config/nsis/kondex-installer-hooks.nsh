; electron-builder NSIS hooks for the Kondex Windows installer.
;
; electron-builder accepts exactly ONE `nsis.include` file, so every customInstall /
; customUnInstall hook Kondex needs lives here.

; ---------------------------------------------------------------------------
; Markdown "Open with Kondex" (issue #10138)
;
; Why hand-rolled instead of electron-builder's `fileAssociations` on Windows:
; app-builder-lib emits !insertmacro APP_ASSOCIATE, whose first line is
;   WriteRegStr SHELL_CONTEXT "Software\Classes\.md" "" "<ProgID>"
; That overwrites whichever editor currently owns .md, with no backup, on a
; later install — and APP_UNASSOCIATE never restores it, so uninstalling Kondex
; would leave .md pointing at a deleted ProgID.
;
; These writes are additive only. Registering a ProgID plus an OpenWithProgids
; hint and an Applications\<exe>\SupportedTypes entry puts Kondex in Explorer's
; "Open with" list and in "Choose another app", while the default handler stays
; exactly where the user left it. Never add a `Software\Classes\.<ext>` default
; value here.
;
; MARKDOWN_PROGID must stay in sync with the extension list handled by
; isMarkdownDocumentName() in src/main/ipc/markdown-documents.ts.
; ---------------------------------------------------------------------------
!define MARKDOWN_PROGID "Kondex.Markdown"

!macro KONDEX_REGISTER_MARKDOWN_OPEN_WITH EXT
  WriteRegNone SHELL_CONTEXT "Software\Classes\${EXT}\OpenWithProgids" "${MARKDOWN_PROGID}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" "${EXT}" ""
!macroend

!macro KONDEX_UNREGISTER_MARKDOWN_OPEN_WITH EXT
  DeleteRegValue SHELL_CONTEXT "Software\Classes\${EXT}\OpenWithProgids" "${MARKDOWN_PROGID}"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" "${EXT}"
!macroend

!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\${MARKDOWN_PROGID}" "" "Markdown Document"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${MARKDOWN_PROGID}\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${MARKDOWN_PROGID}\shell\open" "" "Open with ${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${MARKDOWN_PROGID}\shell\open\command" "" '"$appExe" "%1"'
  !insertmacro KONDEX_REGISTER_MARKDOWN_OPEN_WITH ".md"
  !insertmacro KONDEX_REGISTER_MARKDOWN_OPEN_WITH ".markdown"
  !insertmacro KONDEX_REGISTER_MARKDOWN_OPEN_WITH ".mdx"
  ; Why: Explorer caches the association list until told otherwise.
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend

!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\${MARKDOWN_PROGID}"
  !insertmacro KONDEX_UNREGISTER_MARKDOWN_OPEN_WITH ".md"
  !insertmacro KONDEX_UNREGISTER_MARKDOWN_OPEN_WITH ".markdown"
  !insertmacro KONDEX_UNREGISTER_MARKDOWN_OPEN_WITH ".mdx"
  System::Call "shell32::SHChangeNotify(i,i,i,i) (0x08000000, 0x1000, 0, 0)"
!macroend
