# Kondex 사용법

[English](./usage.md) | **한국어**

Kondex는 코딩 에이전트가 코드를 바꾸기 전에 조직의 맥락을 먼저 쥐여줍니다. 이 문서는
그 한 바퀴를 따라갑니다: 결정이 살아 있는 곳을 연결하고, 거기서 온톨로지를 만들고,
변경이 존중해야 할 근거를 등록하고, Task를 계획하고, 내 구독으로 워커를 돌리고,
워커가 무엇을 받았는지 증명하는 Context Receipt를 읽습니다.

## 시작 전에

- Node.js 24, pnpm 12.
- 구독으로 로그인된 Codex CLI(`codex login`) 또는 Claude Code(`claude`). Kondex는
  API 키를 요구하지 않고, 이미 쓰고 있는 CLI를 그대로 구동합니다.
- Kontext 사이드카. 재귀 클론이면 패키징 때 자동으로 빌드되고, `pnpm dev`는
  [README](../../README.md)의 사이드카 단계를 따르면 됩니다.

`pnpm dev`로 띄우거나, `pnpm build:unpack`이 `dist/` 아래에 만든 앱을 엽니다.

## 1. 프로젝트 추가

랜딩 화면에서(프로젝트가 이미 있으면 워크스페이스 컴포저의 **Add project**로) 폴더나
Git 저장소를 엽니다. 아래 모든 것은 그 워크스페이스 단위이고, `kontext.yaml`은
워크스페이스 루트에 놓입니다.

## 2. 소스 연결과 온톨로지 빌드

사이드바 **Logic Work Items** → **Ontology sources**. 번호가 붙은 4단계이고, 각 단계는
바꾸기 전에 무엇이 있는지 먼저 보여줍니다.

1. **워크스페이스 선택** — 소스를 담을 `kontext.yaml`이 있는 곳.
2. **소스 연결**
   - **GitHub 저장소** — `git clone`에 넣을 주소를 그대로 붙입니다. Kondex가 캐시에
     얕게 클론해서 로컬 폴더처럼 Markdown을 읽고, 확인·빌드마다 체크아웃을 먼저
     갱신합니다. 비공개 저장소는 **내 git 로그인이 되는 범위까지** 읽히며 토큰은
     저장되지 않습니다. 기본 브랜치가 아니면 **브랜치 또는 태그**를 지정합니다.
     캐시 위치는 `~/.cache/kontext-brain/git-sources`(`KONTEXT_GIT_SOURCE_CACHE`로
     변경).
   - **GitHub 조직** — `https://github.com/<org>`를 붙이고 **저장소 목록 불러오기**.
     목록은 내 `gh` 로그인으로 조회되므로 비공개 저장소도 그 로그인이 보는 범위까지
     나오고 토큰은 저장되지 않습니다. 작업 중인 저장소는 기본으로 체크되고, 아카이브와
     포크는 포함을 켤 때까지 숨겨집니다. **선택한 N개 추가**를 누르면 저장소마다
     `<org>-<repo>` 이름의 git 소스가 하나씩 추가됩니다.
   - **소스 코드도 읽기** — 저장소·조직·Markdown 소스에서 TypeScript, JavaScript,
     Python 디렉터리마다 모듈 문서 하나를 만들어 내보낸 심볼로 설명하고, 그 모듈을
     규정하는 문서와 같은 온톨로지 노드에 분류합니다(코드 온톨로지). 소스당 최대 80개
     모듈, 내보내는 것이 많은 순서입니다. 테스트·선언·생성 파일은 건너뜁니다.
     `kontext.yaml`에는 소스에 `code: true`로 기록됩니다.
   - **Claude / Codex에서 가져오기** — 그 에이전트들에 이미 등록한 MCP 서버(Notion,
     Slack, Jira, GitHub…)를 그대로 가져옵니다. **가져오기 미리보기**가 무엇이
     추가될지 먼저 보여줍니다.
   - **Notion / Jira / Slack** — SSE 서버. 제공자가 준 서버 URL을 붙입니다.
   - **GitHub MCP 서버** — PR·이슈 도구용 stdio 서버. **Command**에 `npx`, 인자는 한
     줄에 하나(`-y`, `@modelcontextprotocol/server-github`), 토큰은 **환경변수**
     칸에 `GITHUB_PERSONAL_ACCESS_TOKEN=…`. 환경변수 값은 `kontext.yaml`에
     기록됩니다. 저장소 문서만 필요하면 위의 **GitHub 저장소** 프리셋이 낫습니다 —
     서버도 토큰도 필요 없습니다.
   - **Markdown** — 로컬 디렉터리. **이 워크스페이스의 Markdown도 사용**을 켜면 현재
     저장소의 `.md`가 함께 들어갑니다.
3. **응답 확인** — 모든 소스에 연결해 각각 몇 개의 문서를 내놓는지 보여줍니다.
   답하지 않는 소스는 이름이 찍히고, 지금 빌드하면 그 문서들은 빠진다고 경고합니다.
4. **온톨로지 빌드** — **미리보기**는 저장 없이 만들어질 노드 수를, **빌드하고 저장**은
   `kontext.yaml`에 기록합니다. 노드 수를 비우면 빌더가 정합니다(3–200). 빌드는 수집한
   문서 제목을 `kontext.yaml`의 모델에 보내는데, `provider: codex`면 로그인된 Codex
   구독입니다. 파일에 모델이 없으면(Kondex는 소스만 기록합니다) 빌드가 `provider: codex`를
   쓰고 그 선택을 `kontext.yaml`에 기록합니다. Claude·OpenAI·Ollama를 쓰려면 그 파일의
   `llm:` 절을 고치세요. 에이전트를 시작하거나 결정을 승인하지는 않습니다.

같은 단계가 사이드카 체크아웃의 CLI로도 있습니다:

```
kontext-ontology list
kontext-ontology import-mcp --from claude,codex --project . [--markdown .] --write
kontext-ontology add --name handbook --transport git --url https://github.com/org/handbook.git [--ref main] --write
kontext-ontology add --name github --transport stdio --command npx --arg -y --arg @modelcontextprotocol/server-github --env GITHUB_PERSONAL_ACCESS_TOKEN=… --write
kontext-ontology check
kontext-ontology setup [--target-nodes 40] --write
```

## 3. 근거 등록

같은 **Logic Work Items** 안에서:

- **Markdown 소스** — 선택한 워크스페이스의 저장된 Markdown 파일을 등록합니다(경로는
  워크스페이스 기준). 등록은 콘텐츠 버전을 캡처하고 Resource ID를 돌려주며, 그 자체로
  모델 접근을 허용하지는 않습니다.
- **세션** — Codex나 Claude 세션 저널을 같은 검토 단계로 근거로 등록합니다.
- **소스 모델 권한** — 등록한 소스마다 어떤 런타임(Codex, Claude)이 읽을 수 있는지
  고르고 확인해서 저장합니다. 권한은 캡처된 콘텐츠 버전에 붙고, 내용이 바뀌면 새
  권한이 필요합니다.

## 4. 계획 → 승인 → 실행 → 검증

1. **무엇을 바꿀까요?** — 변경을 설명합니다. **코딩 워크스페이스**를 고르고, 계획이
   존중해야 할 등록 소스를 선택합니다(**등록된 소스 찾기**). **내 구독 사용**을 켜고
   **계획 생성**. 플래너는 내 구독으로 읽기 전용 실행되어 Task 초안을 돌려줍니다:
   코드 리비전, 컨텍스트 다이제스트, 대상, 인수 조건, 계획된 심볼이 붙은 Logic Work
   Item, 사용한 근거 ID.
2. 검토합니다. **수정 초안 요청**은 피드백을 보내고 원본 초안의 다이제스트를 유지합니다.
   **이 작업을 정확히 승인**을 켜고 **승인하고 Task 등록**. 아직 구현은 시작되지
   않았습니다.
3. **등록된 작업** — Task ID와 워크트리가 채워져 있습니다. **구현 런타임**과 워커 수를
   고르고 **구독 CLI 실행 허용…**을 켠 뒤 **스케줄 시작**. 각 워커는 쓰기 전에 Task
   컨텍스트를 먼저 받고, 사이드카는 그 수령에 **Context Receipt**를 발급하며 receipt의
   허용 경로 밖 쓰기를 거부합니다.
4. **새로 고침 / 재검증**이 실행 상태를 보여줍니다. **통합 및 검증**은 계획된 검증기와
   독립 검토를 돌리고, **완료 조건 확인**은 완료 근거를 봅니다. 러너가 끝났다는 것이
   검증된 Task 완료로 취급되는 일은 없습니다.

5. **노드별 내용 보기** — **노드와 소속 문서 보기**를 누르면 노드마다 지식 그래프가
   그 아래에 분류한 문서 수와 일부 문서(소스별)가 나옵니다. 아무것도 없는 노드는
   빌드가 상상한 주제이니 `kontext.yaml`에서 합치거나 지우고 다시 빌드하세요. 빌드가
   도는 동안 4단계에는 지금 단계와 배치(주제 발견, 문서 분류, 지식 기록, 코드 심볼
   투영)가 표시되고, 끝나면 저장된 노드 수가 토스트로 뜹니다.
6. **지식 그래프에 물어보기** — 질문을 치면 연결된 문서와 코드에서 근거(Evidence) ID가
   붙은 조각을 찾아 줍니다. 노드로 걸러 볼 수도 있습니다. 워커도
   `kontext_search_knowledge` 도구로 같은 검색을 쓰므로, 결정이나 모듈에 대한 질문은
   저장소를 다시 긁는 대신 그래프에서 답합니다. 셸에서는 `kontext-ontology query
--question "…" --data-dir <userData>/kontext`, `kontext-ontology nodes --data-dir …`.

### 지식은 어디에 저장되나

빌드는 Notion 페이지, Markdown, 코드 모듈(소스 파일마다 Resource 하나, 심볼마다 Chunk
하나)을 Task 사이드카의 SQLite 그래프(`<userData>/kontext`)에 분류된 노드와 함께
기록합니다. `kontext.yaml`에는 노드 스키마만 남습니다. 설정한 모델 외에는 어디에도
보내지 않습니다.

### 신뢰하는 검증기

Kontext는 워크스페이스가 스스로 선언한 검증기만 실행하는데, 대부분의 프로젝트는
이미 매니페스트로 선언하고 있으므로 따로 추가할 것이 없습니다:

- `package.json` 스크립트 `lint`/`eslint`/`biome`/`oxlint`, `test`,
  `typecheck`/`type-check`/`check-types`/`tsc`, `build`. `packageManager` 필드나
  락파일이 가리키는 패키지 매니저로 실행합니다.
- `pyproject.toml`/`setup.py`: 테스트가 구성돼 있으면 `python3 -m pytest -q`, ruff·mypy
  설정이 있으면 `ruff check .`, `python3 -m mypy .`.
- `go.mod`: `go vet`, `go test`, `go build` (`./...`).
- `Cargo.toml`: `cargo clippy`, `cargo test`, `cargo build`.
- `Makefile`의 `lint`, `test`, `typecheck`, `build` 타깃.

이들은 `workspace:lint`, `workspace:test`, `workspace:typecheck`, `workspace:build`로
나타납니다. 설치된 의존성(`node_modules`, `.venv`)은 런타임 워크트리에 자동으로
링크됩니다. 검사 방식이 특이한 프로젝트만 리포지토리 루트에
`.kontext/verifiers.json`을 둡니다:

```json
{
  "schemaVersion": 1,
  "verifiers": [
    {
      "kind": "lint",
      "ref": "pnpm run check:code-quality:changed",
      "command": "pnpm",
      "args": ["run", "check:code-quality:changed"],
      "timeoutMilliseconds": 600000
    }
  ],
  "linkedDirectories": ["node_modules"]
}
```

플래너는 이 목록을 전달받고 그 안에서만 고르므로, Task가 워크스페이스에서 실행할 수
없는 검사를 이름 붙이는 일이 없습니다. 명령은 셸 없이 워커의 런타임 워크트리에서
실행됩니다. 그 워크트리는 새 체크아웃이라서, 검증기에 필요한 비추적 디렉터리(설치된
`node_modules`, `.venv`)를 `"linkedDirectories"`에 적어 두면 Kontext가 다시 설치하는
대신 내 체크아웃에서 링크해 옵니다.
Kontext 자체의 빠른 검사(semantic sync, stable symbol identity, domain-term·graph-query
검사)는 사이드카가 패치를 관찰한 결과로 판정하므로 항목이 필요 없습니다.

Codex 워커에는 Kontext 도구와 쓰기 훅이 그 워커의 `codex exec`에만 주입되며
`~/.codex`에는 아무것도 쓰지 않습니다. 워커가 제출하는 Change Bundle은
`kontext_check_change`가 돌려준 패치 다이제스트·변경 경로·변경 심볼·검증 실행 ID를
그대로 담아야 하고, 추측으로 만든 번들은 `patch_mismatch`나 `missing_verification`으로
거절됩니다.

### receipt는 어디에 있나

사이드카는 자기가 승인한 쓰기 권한 옆에 receipt를 두며, 앱의 사용자 데이터 디렉터리
아래입니다:

```
<userData>/kontext/write-capabilities/<sha256(워크스페이스 경로)>.json
  → binding.receipt = { receiptId, taskId, workItemId, plannedSymbolIds,
                        allowedPaths, contextDigest, normativeRevisions,
                        evidenceIds, issuedAt, expiresAt }
```

`receiptId`는 정확히 이 필드들의 해시라서, 나중에 다른 근거를 받았다고 고칠 수
없습니다. `<userData>/kontext/task-completion/`의 완료 근거는 receipt를 ID로
참조합니다.

## 문제 해결

- **"Kontext 보조 서버에 연결할 수 없음"** — 사이드카 번들이 없습니다. README대로
  빌드하거나 `KONDEX_KONTEXT_SIDECAR_PATH`를 지정하세요.
- **Codex가 "로그인 필요"** — 터미널에서 `codex login`. Kondex는 그 세션을 재사용합니다.
- **소스가 "응답 없음"** — 서버면 그 명령을 직접 실행해 보고, 저장소면
  `git clone <url>`을 직접 해 보세요. Kondex는 자체 자격증명을 갖지 않습니다.
- **워커의 쓰기가 거부됨** — 경로가 receipt의 `allowedPaths` 밖입니다. 가드가 일한
  것이니, 가드가 아니라 계획을 넓히세요.
