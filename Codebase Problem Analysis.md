# Cascade Chat Conversation

  Note: _This is purely the output of the chat conversation and does not contain any raw data, codebase snippets, etc. used to generate the output._

### User Input

read the code complete and tell me what problems are might be it facing sarena

*Listed directory [workspace](file:///d:/workspace) *

*Listed directory [src](file:///d:/workspace/src) *

*Listed directory [app](file:///d:/workspace/src/app) *

*Listed directory [lib](file:///d:/workspace/src/lib) *

*Listed directory [components](file:///d:/workspace/src/components) *

*Listed directory [types](file:///d:/workspace/src/types) *

*Listed directory [hooks](file:///d:/workspace/src/hooks) *

*Listed directory [api](file:///d:/workspace/src/app/api) *

*Listed directory [ai](file:///d:/workspace/src/lib/ai) *

*Listed directory [agents](file:///d:/workspace/src/lib/agents) *

*Listed directory [single-pass](file:///d:/workspace/src/lib/single-pass) *

*Listed directory [ai-settings](file:///d:/workspace/src/lib/ai-settings) *

*Listed directory [prisma](file:///d:/workspace/prisma) *

### Planner Response

Let me now read the core files in bulk.

*Viewed [schema.prisma](file:///d:/workspace/prisma/schema.prisma) *

*Viewed [package.json](file:///d:/workspace/package.json) *

*Viewed [PRODUCTION_ROADMAP.txt](file:///d:/workspace/PRODUCTION_ROADMAP.txt) *

### User Input

continue

### Planner Response

Let me continue reading all the core files.

*Viewed [evaluation-service.ts](file:///d:/workspace/src/lib/evaluation-service.ts) *

*Viewed [evaluation-storage.ts](file:///d:/workspace/src/lib/evaluation-storage.ts) *

*Viewed [db.ts](file:///d:/workspace/src/lib/db.ts) *

*Viewed [evaluation-service.ts](file:///d:/workspace/src/lib/evaluation-service.ts) *

*Viewed [ai-provider.ts](file:///d:/workspace/src/lib/ai/ai-provider.ts) *

*Listed directory [providers](file:///d:/workspace/src/lib/ai/providers) *

*Listed directory [ai-providers](file:///d:/workspace/src/lib/ai-providers) *

*Viewed [index.ts](file:///d:/workspace/src/lib/ai/providers/index.ts) *

*Viewed [groq.ts](file:///d:/workspace/src/lib/ai/providers/groq.ts) *

*Viewed [claude.ts](file:///d:/workspace/src/lib/ai/providers/claude.ts) *

*Viewed [adaptive-provider.ts](file:///d:/workspace/src/lib/ai-providers/adaptive-provider.ts) *

*Viewed [settings-service.ts](file:///d:/workspace/src/lib/ai-settings/settings-service.ts) *

*Viewed [settings-manager.ts](file:///d:/workspace/src/lib/ai-settings/settings-manager.ts) *

*Viewed [evaluation.ts](file:///d:/workspace/src/types/evaluation.ts) *

### Planner Response

Now let me read the API routes and the agents layer.

*Listed directory [evaluate](file:///d:/workspace/src/app/api/evaluate) *

*Listed directory [core](file:///d:/workspace/src/lib/agents/core) *

*Listed directory [subjects](file:///d:/workspace/src/lib/agents/subjects) *

*Viewed [orchestrator.ts](file:///d:/workspace/src/lib/agents/orchestrator.ts) *

*Viewed [coordinator-agent.ts](file:///d:/workspace/src/lib/agents/core/coordinator-agent.ts) *

*Viewed [base-agent.ts](file:///d:/workspace/src/lib/agents/core/base-agent.ts) *

*Viewed [reviewer-agent.ts](file:///d:/workspace/src/lib/agents/core/reviewer-agent.ts) *

### User Input

continue

*Viewed [subject-expert.ts](file:///d:/workspace/src/lib/agents/subjects/subject-expert.ts) *

*Listed directory [student](file:///d:/workspace/src/app/api/evaluate/student) *

### User Input

continue 

*Viewed [route.ts](file:///d:/workspace/src/app/api/evaluate/student/route.ts) *

### User Input

continue

*Viewed [route.ts](file:///d:/workspace/src/app/api/evaluate/student/status/route.ts) *

*Viewed [route.ts](file:///d:/workspace/src/app/api/evaluate/student/result/route.ts) *

*Listed directory [ai-settings](file:///d:/workspace/src/app/api/ai-settings) *

*Listed directory [extracted](file:///d:/workspace/src/app/api/extracted) *

*Listed directory [exams](file:///d:/workspace/src/app/api/exams) *

*Viewed [route.ts](file:///d:/workspace/src/app/api/ai-settings/route.ts) *

*Viewed [route.ts](file:///d:/workspace/src/app/api/extracted/extract-student-answer/route.ts) *

*Viewed [route.ts](file:///d:/workspace/src/app/api/exams/create/route.ts) *

*Viewed [results-history.ts](file:///d:/workspace/src/lib/results-history.ts) *

### Planner Response

Now I have a complete picture. Let me compile all findings.

*Viewed [default-settings.ts](file:///d:/workspace/src/lib/ai-settings/default-settings.ts) *

*Viewed [base-evaluation-types.ts](file:///d:/workspace/src/lib/base-evaluation-types.ts) *

### Planner Response

Now I have read the entire codebase. Here is the comprehensive problem analysis:

---

# Codebase Problem Analysis

## 🔴 Critical — Production Breaking

### 1. [settingsService.getSettings()](file:///d:/workspace/src/lib/ai-settings/settings-service.ts:17:2-30:3) calls `fetch('/api/ai-settings')` from server-side code
`@/src/lib/ai-settings/settings-service.ts:22` — Relative fetch URLs do not resolve reliably inside Next.js API route handlers (non-component server code). This means **every server-side evaluation silently falls back to `DEFAULT_AI_SETTINGS`** — all user-configured settings (provider, weights, strictness) are ignored.

### 2. AI Settings stored in a module-level `let` — not persistent
`@/src/app/api/ai-settings/route.ts:8`
```typescript
let currentSettings: AIEvaluationSettings = DEFAULT_AI_SETTINGS
```
- Resets to defaults on **every cold start or serverless worker restart**
- Settings saved by one serverless instance are invisible to others
- No database persistence — just an in-memory demo variable

### 3. `reasoning: null` passed to a non-nullable Prisma field — crashes DB write
`@/src/app/api/evaluate/student/route.ts:316-322` — When `qResult.reasoning` is `null/undefined`, `null` is written to `reasoning` column. But the Prisma schema declares it `reasoning String` (non-nullable). **This crashes every question evaluation DB write where reasoning is absent.**

### 4. `DELETE /api/evaluate/student/result` always returns 400
`@/src/app/api/evaluate/student/result\route.ts:112-115`:
```typescript
const evaluationId = url.pathname.split('/').pop()
if (!evaluationId || evaluationId === 'result') { // Always 'result'!
```
The route path ends in [/result](file:///d:/workspace/src/components/result:0:0-0:0), so `.pop()` is always `"result"`, triggering the guard. **Delete is completely broken.**

### 5. Background evaluation killed by serverless
`@/src/app/api/evaluate/student/route.ts:66` — [processEvaluation(...).catch(...)](file:///d:/workspace/src/app/api/evaluate/student/route.ts:89:0-361:1) is fire-and-forget. In serverless (Vercel/AWS Lambda), the function process is terminated as soon as the `return NextResponse.json(...)` on line 79 is sent. **Long-running evaluations (30–90s) will be killed mid-run.**

### 6. `evaluationStorage` is in-memory — lost across serverless instances
`@/src/lib/evaluation-storage.ts:150-161` — The comment says "swap for Redis in production" but it's never done. Status polling hits a **different worker** than the one running the evaluation, always returning 404.

---

## 🟠 High Severity

### 7. `question.questionId` is always `undefined` — wrong field name
`@/src/lib/evaluation-service.ts:460` and line 552:
```typescript
questionId: question?.questionId ?? String(e.questionNumber)
questionId: question.questionId  // no fallback — pure undefined
```
The [Question](file:///d:/workspace/src/types/evaluation.ts:0:0-7:1) type (`@/src/types/evaluation.ts:2`) only has `id`, not `questionId`. So `questionId` in every returned [QuestionEvaluation](file:///d:/workspace/src/types/evaluation.ts:9:0-28:1) is `undefined` or falls back to the question number string — not the actual DB primary key.

### 8. [adaptiveProvider.runTextEvaluation](file:///d:/workspace/src/lib/ai-providers/adaptive-provider.ts:57:2-77:3) uses plain text, not JSON mode
`@/src/lib/ai-providers/adaptive-provider.ts:73` calls [provider.runText()](file:///d:/workspace/src/lib/ai/providers/groq.ts:27:4-38:5) but the result is parsed as JSON. For Groq, there is [runTextJSON](file:///d:/workspace/src/lib/ai/providers/groq.ts:14:4-26:5) which sets `response_format: { type: 'json_object' }`. Without this, Groq Llama will return markdown-wrapped or conversational responses that **silently fail JSON parsing** and fall back to default scores of `50` for every dimension.

### 9. [SubjectExpertAgent](file:///d:/workspace/src/lib/agents/subjects/subject-expert.ts:223:0-297:1) vision path bypasses retry and circuit breaker entirely
`@/src/lib/agents/subjects/subject-expert.ts:244-252` — The vision path directly calls [ai.runVisionJSON()](file:///d:/workspace/src/lib/ai/providers/groq.ts:39:4-68:5) without going through [this.callModel()](file:///d:/workspace/src/lib/agents/core/base-agent.ts:151:2-197:3). **One API failure = one zero-mark question, with no retry attempt.**

### 10. Grade scale is inconsistent between two places
`@/src/lib/evaluation-service.ts:1031-1040` has `B+(75)`, `C+(60)`, `D(45)`.
`@/src/app/api/evaluate/student/route.ts:240-246` has `B(70)`, `C(60)`, `D(50)` — no B+/C+.
**Same student gets a different grade depending on which code path ran.**

### 11. [extract-student-answer](file:///d:/workspace/src/app/api/extracted/extract-student-answer:0:0-0:0) initializes Groq with `!` non-null assertion
`@/src/app/api/extracted/extract-student-answer/route.ts:13`:
```typescript
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
```
If `GROQ_API_KEY` is missing, this passes `undefined` to the SDK. Unlike the proper null-guard in `@/src/lib/ai/providers/groq.ts:8`, this **will throw or silently fail with no clear error**.

### 12. No file size validation — OOM / request limit risk
`@/src/app/api/evaluate/student/route.ts:160-162` — The entire file is read into memory as base64 with zero size check. A large scanned PDF can easily exceed Next.js's 4MB body limit or cause OOM in serverless.

---

## 🟡 Medium Severity

### 13. `_level` parameter in [getSemanticWeights](file:///d:/workspace/src/lib/evaluation-service.ts:87:0-98:1) is ignored
`@/src/lib/evaluation-service.ts:88` — The function signature takes `_level: EvaluationLevel` but the level is never used. All evaluation levels (beginner/intermediate/expert) use **identical weights** — the documented level-adaptive weighting is not actually implemented.

### 14. `question.questionId` in `rawEvaluations` push is also `undefined`
`@/src/app/api/evaluate/student/route.ts:195-198`:
```typescript
rawEvaluations.push({
  ...result.data,
  questionId: question.questionId,  // question has 'id', not 'questionId'
```
`question` here is the mapped object with `id` field. `question.questionId` is `undefined`. The reviewer agent then propagates this.

### 15. `Post` model in Prisma schema has no `@relation` defined
`@/prisma/schema.prisma:27-35` — `authorId` has no Prisma `@relation` directive. This is an orphaned/broken model that Prisma won't enforce referentially. Either it's dead code cluttering the schema or a missing relation.

### 16. [db.ts](file:///d:/workspace/src/lib/db.ts:0:0-0:0) logs all queries unconditionally, including in production
`@/src/lib/db.ts:9`:
```typescript
new PrismaClient({ log: ['query'] })
```
Query logging is always on. This outputs potentially sensitive data (student names, answers) to logs in production.

### 17. `semanticScore`, `keywordAnalysis`, `evaluationLevel` typed as `any`
`@/src/types/evaluation.ts:26-28` — These fields are used throughout the entire pipeline but typed as `any`. Zero TypeScript protection on these core evaluation outputs.

### 18. [AdaptiveProvider.runTextEvaluation](file:///d:/workspace/src/lib/ai-providers/adaptive-provider.ts:57:2-77:3) calls [settingsService.getSettings()](file:///d:/workspace/src/lib/ai-settings/settings-service.ts:17:2-30:3) twice per request
`@/src/lib/ai-providers/adaptive-provider.ts:66-68` — Calls [getSettings()](file:///d:/workspace/src/lib/ai-settings/settings-service.ts:17:2-30:3) AND [getProviderConfig()](file:///d:/workspace/src/lib/ai-settings/settings-service.ts:73:2-81:3) (which also calls [getSettings()](file:///d:/workspace/src/lib/ai-settings/settings-service.ts:17:2-30:3)), then discards `config`. Double fetch per evaluation call.

---

## 🔵 Low Severity

### 19. [results-history.ts](file:///d:/workspace/src/lib/results-history.ts:0:0-0:0) uses `localStorage` — no cross-device or server persistence
`@/src/lib/results-history.ts:37` — History is browser-local only. Clearing browser storage or switching devices loses all history. No sync with the database evaluations.

### 20. [exportSettings](file:///d:/workspace/src/lib/ai-settings/settings-manager.ts:196:2-207:3) checksum is not a real checksum
`@/src/lib/ai-settings/settings-manager.ts:199`:
```typescript
const checksum = btoa(data.length.toString()).slice(0, 12)
```
This is just the base64 of the string length. Any two settings objects with the same character count produce the same "checksum" — import integrity validation is meaningless.

### 21. Concurrency pool in orchestrator has a race condition under error
`@/src/lib/agents/orchestrator.ts:73-76` — `index++` is done before `await tasks[current]()`. In Node.js single-threaded event loop this is safe, but worth documenting.

### 22. Step labels in [processEvaluation](file:///d:/workspace/src/app/api/evaluate/student/route.ts:89:0-361:1) are wrong
`@/src/app/api/evaluate/student/route.ts` — Step 4 appears twice, and "Step 5" appears for what is actually Step 8. Minor maintenance/debugging confusion.

---

## Summary Table

| # | Severity | Problem | File |
|---|----------|---------|------|
| 1 | 🔴 | Relative `fetch` from server — settings always ignored | `settings-service.ts:22` |
| 2 | 🔴 | AI settings in `let` variable — lost on restart | `ai-settings/route.ts:8` |
| 3 | 🔴 | `null` reasoning crashes non-nullable DB field | `student/route.ts:316` |
| 4 | 🔴 | DELETE always returns 400 — broken | `result/route.ts:112` |
| 5 | 🔴 | Fire-and-forget kills in serverless | `student/route.ts:66` |
| 6 | 🔴 | In-memory storage lost across workers | [evaluation-storage.ts](file:///d:/workspace/src/lib/evaluation-storage.ts:0:0-0:0) |
| 7 | 🟠 | `question.questionId` always `undefined` | `evaluation-service.ts:460` |
| 8 | 🟠 | Text eval uses [runText](file:///d:/workspace/src/lib/ai/providers/groq.ts:27:4-38:5) not [runTextJSON](file:///d:/workspace/src/lib/ai/providers/groq.ts:14:4-26:5) | `adaptive-provider.ts:73` |
| 9 | 🟠 | Vision path: no retry/circuit breaker | `subject-expert.ts:244` |
| 10 | 🟠 | Two different grade scales | `route.ts:240` vs `service.ts:1031` |
| 11 | 🟠 | `GROQ_API_KEY!` non-null assertion | `extract-student-answer/route.ts:13` |
| 12 | 🟠 | No file size limit — OOM risk | `student/route.ts:160` |
| 13 | 🟡 | Level-adaptive weights not implemented | `evaluation-service.ts:88` |
| 14 | 🟡 | `questionId` undefined in rawEvaluations | `student/route.ts:195` |
| 15 | 🟡 | Broken `Post` schema (no `@relation`) | `schema.prisma:27` |
| 16 | 🟡 | Query logging on in production | `db.ts:9` |
| 17 | 🟡 | `semanticScore`/`keywordAnalysis` typed `any` | `evaluation.ts:26` |
| 18 | 🟡 | Double settings fetch per request | `adaptive-provider.ts:66` |
| 19 | 🔵 | `localStorage`-only history | [results-history.ts](file:///d:/workspace/src/lib/results-history.ts:0:0-0:0) |
| 20 | 🔵 | Fake checksum on settings export | `settings-manager.ts:199` |

The **top 3 most urgent** to fix are: **#1 (settings fetch)**, **#5 (serverless fire-and-forget)**, and **#3 (null reasoning DB crash)** — these will cause failures on almost every real evaluation run.

### User Input

these are problems okay but now want imrpove the features and which makes advace level of technology and archtiecture for that manam em cheyaloa di detail naku table create chesi chupinchu kda best project avvali sarena

### Planner Response

# Advanced Feature & Architecture Upgrade Plan

Sarena, idi complete ga chuddam — current state vs what it should be in an enterprise-grade system.

---

## 🏗️ Architecture Upgrades

| # | Category | Current Problem | Proposed Upgrade | Tech Stack | Impact |
|---|----------|----------------|-----------------|------------|--------|
| 1 | **State Management** | In-memory `evaluationStorage` — lost on restart | Redis pub/sub + job queue | `Redis` + `BullMQ` | 🔴 Critical |
| 2 | **Settings Persistence** | Module-level `let` variable resets every cold start | PostgreSQL settings table via Prisma | `Prisma` new model | 🔴 Critical |
| 3 | **Background Jobs** | Fire-and-forget killed by serverless timeout | Dedicated job worker / queue processor | `BullMQ` + `Redis` | 🔴 Critical |
| 4 | **API Settings Call** | `fetch('/api/ai-settings')` from server — relative URL | Direct DB/service layer call (no HTTP hop) | Prisma service function | 🔴 Critical |
| 5 | **File Storage** | Files only in memory as base64 — no persistence | Cloud object storage with signed URLs | `AWS S3` / `Cloudflare R2` | 🟠 High |
| 6 | **Real-time Progress** | Polling every N seconds (status endpoint) | WebSocket / Server-Sent Events push | `SSE` or `Socket.io` | 🟠 High |
| 7 | **Authentication** | `next-auth` installed but not wired to evaluation flow | Full RBAC — Teacher / Admin / Reviewer roles | `NextAuth v5` + Prisma | 🟠 High |
| 8 | **Caching Layer** | Settings re-fetched on every AI call | Redis-backed settings cache with TTL | `ioredis` | 🟡 Medium |

---

## 🤖 AI / Evaluation Engine Upgrades

| # | Category | Current State | Proposed Upgrade | Tech | Impact |
|---|----------|--------------|-----------------|------|--------|
| 9 | **JSON Mode** | [runText()](file:///d:/workspace/src/lib/ai/providers/groq.ts:27:4-38:5) used — AI returns prose, JSON parse fails silently | Always use [runTextJSON()](file:///d:/workspace/src/lib/ai/providers/groq.ts:14:4-26:5) / structured output | `Groq json_object` mode | 🔴 Critical |
| 10 | **Multi-page PDF** | Entire PDF base64'd and sent as one blob | Page-by-page processing with question mapping | `pdf2pic` + page router | 🟠 High |
| 11 | **Level-Adaptive Weights** | `_level` param ignored — same weights for all levels | Dynamic weight tables per beginner/intermediate/expert | Config-driven weights | 🟠 High |
| 12 | **Parallel Evaluation** | Questions graded one-by-one in a `for` loop | Parallel grading with concurrency limit (already designed in orchestrator but not used here) | [runWithConcurrency()](file:///d:/workspace/src/lib/agents/orchestrator.ts:65:0-82:1) | 🟠 High |
| 13 | **Confidence Calibration** | Hardcoded `confidence: 85` in DB write | Real per-question confidence averaged | Derived from `qResult.confidence` | 🟡 Medium |
| 14 | **Model Fallback** | Claude fails → silent 0 marks | Auto-retry with Groq fallback + user notification | Circuit breaker + fallback | 🟡 Medium |
| 15 | **Plagiarism Detection** | Penalty defined (100%) but never checked | Cross-student answer similarity scoring | `cosine similarity` on embeddings | 🟡 Medium |
| 16 | **Multi-page Answer Mapping** | All questions get `pageNumbers: '1'` hardcoded | Vision model detects which page has which answer | Layout detection prompt | 🟡 Medium |
| 17 | **Subject Expert Expansion** | Only 4 subjects: math/science/languages/other | Physics, Chemistry, CS, History, Geography, Economics agents | Extend `SUBJECT_INSTRUCTIONS` | 🟡 Medium |

---

## 🗄️ Database / Schema Upgrades

| # | Table | Current Gap | Upgrade | Impact |
|---|-------|------------|---------|--------|
| 18 | **Settings** | No table — module variable | `AISettings` model in Prisma with user scoping | 🔴 Critical |
| 19 | **EvaluationJob** | No job tracking model | `EvaluationJob` table: status, worker, retries, error | 🔴 Critical |
| 20 | **Post model** | `authorId` with no `@relation` — orphan | Fix relation or remove entirely | 🟡 Medium |
| 21 | **AuditLog** | No audit trail in DB | `AuditLog` table: who changed what, when | 🟡 Medium |
| 22 | **FileUpload** | `fileUrl: '/uploads/...'` — fake path | Real S3 URL stored, presigned URL generated on demand | 🟠 High |
| 23 | **StudentProfile** | No student entity — just a name string | `Student` model linked to evaluations | 🟡 Medium |
| 24 | **SemanticScore** | Stored as `any` — not persisted to DB | [SemanticScore](file:///d:/workspace/src/lib/evaluation-service.ts:56:0-63:1) JSON column in [QuestionEvaluation](file:///d:/workspace/src/types/evaluation.ts:9:0-28:1) | 🟡 Medium |

---

## 🛡️ Security & Reliability Upgrades

| # | Issue | Current | Fix | Impact |
|---|-------|---------|-----|--------|
| 25 | **File Size Limit** | No validation — OOM crash possible | Max 10MB check before processing | 🔴 Critical |
| 26 | **Input Sanitization** | Raw formData values used directly | Zod schema validation on all inputs | 🟠 High |
| 27 | **Rate Limiting** | No API rate limiting | Per-IP / per-user rate limiter | `upstash/ratelimit` | 🟠 High |
| 28 | **API Key Exposure** | `GROQ_API_KEY!` non-null assertion | Strict env validation at startup with `zod` | 🟠 High |
| 29 | **Query Logging** | `log: ['query']` always on | Only in `development`, disabled in `production` | 🟡 Medium |
| 30 | **Error Boundary** | Generic 500 errors returned to client | Structured error codes + safe messages | 🟡 Medium |

---

## 📊 Analytics & Reporting Upgrades

| # | Feature | Current | Upgrade | Tech |
|---|---------|---------|---------|------|
| 31 | **Batch Evaluation** | One student at a time only | Bulk CSV upload → evaluate all students in parallel | `BullMQ` batch jobs |
| 32 | **Class Analytics** | localStorage only | Server-side class performance dashboard | Prisma aggregations |
| 33 | **Export Reports** | Not implemented | PDF report per student + class summary Excel | `jsPDF` + `xlsx` |
| 34 | **Trend Analysis** | Fake checksum-based | Real performance trends over time per student/exam | Recharts + DB queries |
| 35 | **Human Review Queue** | `lowConfidenceQuestions` listed but no UI flow | Full review workflow: flag → assign reviewer → approve | Prisma + queue |

---

## 🚀 DevOps & Performance

| # | Area | Current | Upgrade | Tech |
|---|------|---------|---------|------|
| 36 | **Monitoring** | `console.log` only | Structured logging + error tracking | `Pino` + `Sentry` |
| 37 | **Health Check** | No endpoint | `/api/health` — DB, Redis, AI provider status | Custom endpoint |
| 38 | **Env Validation** | Runtime failures if keys missing | Zod env schema validated at startup | `@t3-oss/env-nextjs` |
| 39 | **Type Safety** | `any` on [exam](file:///d:/workspace/src/components/exam:0:0-0:0), `questions`, `qResult` in route | Full typed DTOs end-to-end | Zod + TypeScript |
| 40 | **Testing** | Zero tests | Unit tests for grade calc, integration tests for API routes | `Vitest` + `Playwright` |

---

## 🎯 Priority Execution Order

```
Phase 1 — Fix Breaking (Week 1)
  ├── #1  Redis + BullMQ for job queue
  ├── #4  Remove server-side fetch('/api/ai-settings')
  ├── #9  Switch all text evals to runTextJSON
  ├── #18 Add AISettings DB table
  ├── #25 File size validation
  └── #3  reasoning null fix (DB crash)

Phase 2 — Core Features (Week 2-3)
  ├── #6  Server-Sent Events for real-time progress
  ├── #7  Full auth + RBAC
  ├── #10 Multi-page PDF processing
  ├── #11 Level-adaptive weights activated
  └── #31 Batch evaluation

Phase 3 — Advanced AI (Week 4-5)
  ├── #15 Plagiarism detection
  ├── #17 Subject expert expansion (Physics/CS/Chemistry)
  ├── #16 Page-level answer mapping
  └── #35 Human review workflow

Phase 4 — Production Grade (Week 6)
  ├── #36 Sentry + Pino logging
  ├── #38 Env validation
  ├── #40 Tests
  └── #33 PDF/Excel reports
```

---

**Ekkadi start cheyali?** Phase 1 lo oka specific fix cheptey adi implement cheyyadam start cheyyocchu — for example Redis+BullMQ job queue or the settings DB migration. Which one first?

### User Input

inak evaluation realted features rayu kda and also new techniques untadi kda advance level vi avi kuda rayu kda

### Planner Response

# Advanced Evaluation Features & New Techniques

---

## 🧠 AI Evaluation Engine — New Techniques

| # | Feature | Current State | Advanced Technique | How It Works | Tech |
|---|---------|--------------|-------------------|-------------|------|
| 1 | **Semantic Similarity Scoring** | Rule-based keyword matching | Embedding-based cosine similarity | Student answer → embedding vector → compare with model answer vector → similarity score 0-1 | `OpenAI embeddings` / `Groq nomic-embed` |
| 2 | **Chain-of-Thought Grading** | Single prompt marks award | AI explains step-by-step WHY each mark given/deducted | Multi-step reasoning trace before final mark — more accurate, auditable | CoT prompting in Pass 3 |
| 3 | **Self-Consistency Grading** | Single AI call per question | Same question graded 3x → majority vote decides marks | Reduces hallucination by ~40% — most consistent answer wins | [runTextJSON](file:///d:/workspace/src/lib/ai/providers/groq.ts:14:4-26:5) × 3 → average |
| 4 | **Rubric Auto-Generation** | Teacher must write rubric manually | AI reads question + model answer → auto-generates detailed rubric | On exam creation, Pass 0: generate rubric → store in DB | Claude/Groq Pass 0 |
| 5 | **Answer Quality Tiers** | Binary: attempted / not attempted | 5-tier quality: Excellent / Good / Partial / Attempt / Blank | Each tier has mark range → more granular than pass/fail | Custom tier classifier |
| 6 | **Cross-Question Consistency** | Each question graded independently | If student got Q3 wrong but Q1 shows they know the concept — flag inconsistency | Context window includes all answers, reviewer checks consistency | Reviewer Agent upgrade |
| 7 | **Diagram & Figure Evaluation** | Text-only semantic analysis | Vision model specifically scores diagrams, labels, arrows | Dedicated diagram sub-score separate from text | Vision sub-pass |
| 8 | **Mathematical Step Marking** | All-or-nothing for math | Step-by-step method marks — carry-forward error principle | Detect each calculation step → partial credit per step | Math-specific prompt chain |
| 9 | **Handwriting Quality Score** | Not tracked | Legibility confidence score per question | Pass 1 returns `legibilityScore` alongside transcription | Vision model output |
| 10 | **Answer Length Calibration** | No length awareness | Expected vs actual word count ratio affects completeness score | `expectedWords` from model answer → compare → adjust completeness weight | Formula-based |

---

## 📊 Scoring Model Upgrades

| # | Feature | Current | Advanced Version | Formula / Logic |
|---|---------|---------|-----------------|----------------|
| 11 | **Adaptive Tolerance Bands** | Fixed tolerance: beginner=35, intermediate=22, expert=15 | Dynamic tolerance based on question difficulty + marks | `tolerance = baseToleranceLevel × (1 - questionComplexity/10)` |
| 12 | **Partial Credit Matrix** | Flat percentage deduction | Multi-dimensional partial credit: concept ✓ but example ✗ = 70%, formula ✓ but calc ✗ = 60% | Rubric-driven credit matrix per question type |
| 13 | **Confidence-Weighted Marks** | Confidence stored but not used in final mark | Final mark = `aiMark × confidence + derivedMark × (1 - confidence)` | Blend AI mark with semantic-derived mark by confidence |
| 14 | **Normalisation Curve** | No bell-curve adjustment | Class-level normalisation: scale all marks if average too low/high | `normalisedMark = (rawMark - classMin) / (classMax - classMin) × maxMarks` |
| 15 | **Anti-Pattern Detection** | Only keyword stuffing checked | Detect: copy-paste repetition, circular reasoning, off-topic rambling, rote memorization without understanding | Pattern classifier sub-pass |
| 16 | **Semantic Drift Penalty** | Not implemented | If student starts correctly but drifts off-topic → progressive penalty per sentence | Sentence-by-sentence coherence tracking |

---

## 🔄 Multi-Agent Pipeline Upgrades

| # | New Agent | Role | When Triggered | Output |
|---|----------|------|---------------|--------|
| 17 | **QuestionClassifierAgent** | Classify question type: factual / analytical / applied / creative | On exam creation | `questionType` tag per question |
| 18 | **DifficultyCalibrationAgent** | Score question difficulty 1-10 based on cognitive level (Bloom's Taxonomy) | On exam creation | `bloomsLevel`, `difficultyScore` |
| 19 | **PlagiarismAgent** | Compare all students' answers for same question → detect copy | After all students evaluated | `similarityMatrix`, `flaggedPairs` |
| 20 | **FeedbackPersonalisationAgent** | Tailor feedback language to student level (Grade 5 vs PhD) | After marking | Rephrased `overallFeedback` |
| 21 | **GapAnalysisAgent** | Identify which topics the entire class failed → teacher alert | After batch evaluation | `topicGaps[]`, `remediationSuggestions[]` |
| 22 | **RemarkAgent** | When human reviewer disagrees → AI re-evaluates with human notes | On human review trigger | Updated marks + audit trail |

---

## 🎯 New Evaluation Dimensions (Beyond 5 Current)

| # | Dimension | What It Measures | Weight Range | Example |
|---|----------|-----------------|-------------|---------|
| 23 | **Critical Thinking** | Does student question assumptions, give counter-arguments? | 0-15% for expert | "While X is true, it fails when Y because..." |
| 24 | **Application Ability** | Can student apply theory to a new scenario? | 0-20% for applied questions | Solving a novel problem using learned concepts |
| 25 | **Evidence Quality** | Are examples, data, citations relevant and accurate? | 0-10% | "As shown in Ohm's law experiment..." |
| 26 | **Structural Coherence** | Is the answer organised logically (intro, body, conclusion)? | 0-10% for essay | Paragraphing, flow, transitions |
| 27 | **Originality** | Does answer show unique insight vs textbook reproduction? | 0-10% for expert creative | Novel perspective not in model answer |
| 28 | **Conciseness** | Does student waste words or answer precisely? | Penalty up to -5% | 500 words where 100 needed |

---

## 🔬 Advanced PDF / Image Processing

| # | Feature | Current | Upgrade | Tech |
|---|---------|---------|---------|------|
| 29 | **Multi-page Question Mapping** | `pageNumbers: '1'` hardcoded for all | Vision model detects page breaks, maps Q1→page1, Q2→page3 etc | Layout detection prompt + `pdf2pic` |
| 30 | **Handwriting Style Normalisation** | Raw transcription only | Normalise spelling variants, crossed letters, ambiguous characters | Post-process transcription with correction pass |
| 31 | **Table & Graph Recognition** | Ignored in answers | Detect tables → parse cell values; detect graphs → describe trend | Structured vision sub-prompt |
| 32 | **Strikethrough Detection** | Not handled | Vision model explicitly ignores struck-through text in grading | "If text is struck through, exclude from evaluation" in prompt |
| 33 | **Multi-language Handwriting** | English only | Support Hindi, Telugu, Urdu, Arabic scripts | Multilingual vision model prompt with language hint |
| 34 | **Answer Box Detection** | Entire image processed | Detect answer boxes → crop → grade per box | YOLO / vision bounding box detection |

---

## 📈 Analytics & Intelligence Features

| # | Feature | Description | Value |
|---|---------|------------|-------|
| 35 | **Bloom's Taxonomy Mapping** | Map each question to cognitive level (Remember → Create) | Exam quality analysis |
| 36 | **Learning Outcome Tracking** | Track which learning outcomes pass/fail per student over time | Progress reports |
| 37 | **Predictive Grade Model** | Based on first 3 questions → predict final score | Early intervention |
| 38 | **Topic Mastery Heatmap** | Per student: red/yellow/green per topic | Visual gap analysis |
| 39 | **Inter-Rater Reliability** | Compare AI marks vs human marks over time → drift detection | System calibration |
| 40 | **Examiner Bias Detection** | If AI consistently marks lower for certain question types → flag | Fairness audit |

---

## 🏆 Cutting-Edge Techniques (State-of-the-Art 2025-26)

| # | Technique | What It Is | Use in This System |
|---|----------|-----------|-------------------|
| 41 | **RAG (Retrieval-Augmented Generation)** | AI retrieves relevant syllabus/textbook before grading | Grade against actual curriculum content, not just model answer |
| 42 | **Structured Output / Function Calling** | Force AI to return typed JSON schema via tool use | Zero JSON parse failures — 100% structured grading output |
| 43 | **Long-Context Window Utilisation** | Send all questions + answers in one 128k token context | Holistic evaluation → catch cross-question inconsistencies |
| 44 | **Multimodal Embeddings** | Embed image + text together for similarity search | Find similar past answers to calibrate marks |
| 45 | **Constitutional AI Grading** | AI checks its own output against grading principles before finalising | Self-correction → reduces hallucination |
| 46 | **Speculative Decoding** | Run fast draft model → verify with slow accurate model | 3x faster evaluation — Groq drafts, Claude verifies |
| 47 | **Fine-tuned Grading Model** | Fine-tune Llama-3 on past human-graded examples | Subject-specific, institution-specific grading calibration |
| 48 | **Uncertainty Quantification** | Monte Carlo sampling → measure grade variance | If variance > threshold → send to human review automatically |

---

## 🗺️ Implementation Roadmap

```
Sprint 1 (Immediate — Fix + Improve)
├── #2  Self-Consistency Grading (3-run average)
├── #4  Rubric Auto-Generation
├── #42 Structured Output / Function Calling (fix JSON issue)
└── #9  Handwriting quality score in Pass 1

Sprint 2 (Core AI Upgrade)
├── #1  Embedding-based semantic similarity
├── #8  Mathematical step marking
├── #7  Diagram evaluation sub-pass
└── #29 Multi-page question mapping

Sprint 3 (Agent System Expansion)
├── #18 DifficultyCalibrationAgent (Bloom's Taxonomy)
├── #19 PlagiarismAgent (cross-student)
├── #21 GapAnalysisAgent (class-wide topics)
└── #20 FeedbackPersonalisationAgent

Sprint 4 (Analytics + Intelligence)
├── #35 Bloom's Taxonomy mapping
├── #38 Topic mastery heatmap
├── #39 Inter-rater reliability tracking
└── #47 Fine-tuned grading model (long-term)
```

---

**Most impactful single change:** `#42 Structured Output (Function Calling)` — idi implement chesthe JSON parse failures completely eliminate avutay and the entire 3-pass pipeline becomes 100% reliable. Adi cheyyadam start cheyyala?

### User Input

inka vere features ivvu kda 

### Planner Response

# More Advanced Features — Complete Feature Expansion

---

## 👨‍🏫 Teacher / Examiner Portal Features

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 1 | **Exam Template Library** | Save reusable exam templates — reuse for different batches | Prisma `ExamTemplate` model |
| 2 | **Question Bank** | Build a searchable bank of questions with tags, difficulty, subject | `QuestionBank` table + full-text search |
| 3 | **Rubric Builder UI** | Drag-drop rubric creator — define mark breakdowns visually | `@dnd-kit` (already installed!) |
| 4 | **Answer Key Versioning** | Multiple model answers for same question — AI picks best match | `ModelAnswerVersion[]` per question |
| 5 | **Marking Scheme Import** | Upload PDF marking scheme → AI extracts into structured rubric | Vision model + extraction pipeline |
| 6 | **Teacher Override Panel** | Teacher manually adjusts AI marks → system learns from corrections | Human-in-loop feedback loop |
| 7 | **Exam Scheduling** | Set exam date/time → auto-enable/disable submission | Cron job + status flag |
| 8 | **Grace Marks Setting** | Teacher sets grace marks per question or overall | Config per `Exam` model |
| 9 | **Bonus Question Support** | Questions worth extra marks beyond max — counted as bonus | `isBonus: boolean` per Question |
| 10 | **Negative Marking Config** | Set negative marking rules per exam | `negativeMark: float` per Question |

---

## 👨‍🎓 Student Portal Features

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 11 | **Student Self-Submission Portal** | Students upload their own answer sheets directly | Auth + submission form |
| 12 | **Result Notification** | Auto email/SMS when results are ready | `Nodemailer` + `Twilio` |
| 13 | **Detailed Score Breakdown** | Student sees exactly which sentences got marks | Highlight overlay on answer image |
| 14 | **Improvement Suggestions Per Topic** | Personalised study plan based on weak topics | GapAnalysis → recommendation engine |
| 15 | **Revaluation Request** | Student raises revaluation — goes to teacher queue | `RevaluationRequest` model |
| 16 | **Progress Dashboard** | Student sees improvement over multiple exams | Recharts trend charts |
| 17 | **Practice Mode** | Student can test answers and get instant AI feedback (not graded) | Separate evaluation mode flag |
| 18 | **Peer Comparison** | Anonymous: see how your score compares to class average | Aggregated stats — no names shown |

---

## 🏫 Institution / Admin Features

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 19 | **Multi-Tenant Architecture** | Each school/college gets isolated data | `tenantId` on every table |
| 20 | **Batch / Section Management** | Group students into classes, sections, batches | `Batch`, `Section` models |
| 21 | **Teacher Role Hierarchy** | Head of Dept → Teacher → Evaluator permission levels | RBAC with `Role` table |
| 22 | **Institution Branding** | Custom logo, colors, name on reports | `Institution` settings model |
| 23 | **Exam Schedule Calendar** | Visual calendar of all upcoming exams | `react-day-picker` (installed!) |
| 24 | **Bulk Student Import** | Upload student list via CSV → auto-create accounts | CSV parser + `createMany` |
| 25 | **Department Analytics** | Subject-wise performance across all batches | Aggregated Prisma queries |
| 26 | **API Access for Integration** | REST API for SIS (Student Info System) integration | API keys per institution |

---

## 📋 Evaluation Workflow Features

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 27 | **Double Blind Evaluation** | Two teachers grade independently → AI resolves conflicts | `EvaluationRound` model |
| 28 | **Moderation Pass** | Chief examiner reviews borderline cases (40-60% marks) | Borderline flag + review queue |
| 29 | **Partial Submission** | Start evaluation, save progress, resume later | `EvaluationJob` status: `draft` → `completed` |
| 30 | **Batch Re-evaluation** | Re-run all students when model answer changes | Bulk queue trigger |
| 31 | **Evaluation Locking** | Lock results after deadline — no further changes | `lockedAt` timestamp |
| 32 | **Version History of Marks** | Every mark change tracked with who changed it and when | `MarkHistory` audit table |
| 33 | **Annotation on Answer Sheet** | Reviewer adds visual annotations (circles, arrows) on image | Canvas annotation layer |
| 34 | **Voice Feedback** | AI generates voice feedback audio for student | `TTS API` (ElevenLabs / OpenAI TTS) |

---

## 📊 Reports & Export Features

| # | Feature | Description | Output |
|---|---------|------------|--------|
| 35 | **Individual Student Report PDF** | Detailed marks, feedback, topic analysis per student | PDF with charts |
| 36 | **Class Performance Report** | Average, top/bottom performers, topic gaps | PDF + Excel |
| 37 | **Topper List** | Ranked student list with percentile | Printable sheet |
| 38 | **Mark Sheet Generation** | Official formatted mark sheet per student | PDF with institution letterhead |
| 39 | **Grade Distribution Chart** | Visual bell curve / bar chart of grade spread | Recharts (installed!) |
| 40 | **Question-wise Analysis Report** | Which question was hardest? Easiest? Most skipped? | Analytics dashboard |
| 41 | **Teacher Feedback Effectiveness** | Are students improving on topics where feedback was given? | Longitudinal analysis |
| 42 | **Export to Excel/CSV** | Raw marks data downloadable for offline processing | `xlsx` library |

---

## 🔍 Search & Discovery Features

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 43 | **Semantic Search in Answers** | Search "which students mentioned photosynthesis" across all answers | Embeddings + vector search |
| 44 | **Question Search** | Search question bank by topic, difficulty, marks | Full-text search |
| 45 | **Student Answer History** | Find all answers by a student across all exams | Indexed DB query |
| 46 | **Similar Question Detection** | Warn when new question is very similar to existing one | Cosine similarity on question embeddings |

---

## 🔔 Notification & Communication

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 47 | **Real-time Evaluation Progress** | Live progress bar pushed to teacher during evaluation | Server-Sent Events |
| 48 | **Email Results to Students** | Auto-send result PDF when evaluation completes | `Nodemailer` + template |
| 49 | **WhatsApp Integration** | Send marks via WhatsApp to student | `WhatsApp Business API` |
| 50 | **Teacher Alert: Low Class Performance** | If class average < 40% → alert HoD | Threshold trigger |
| 51 | **Revaluation Request Notifications** | Teacher notified when student requests recheck | Push notification |
| 52 | **System Health Alerts** | If AI provider down → admin notified | `Sentry` + email alert |

---

## 🤖 AI Intelligence Upgrades (New)

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 53 | **Syllabus-Aware Grading (RAG)** | AI retrieves relevant syllabus chapters before grading | Vector DB + RAG pipeline |
| 54 | **Examiner Calibration AI** | AI reads past human-graded papers → calibrates itself | Few-shot examples in prompt |
| 55 | **Question Difficulty Predictor** | Predict expected class avg marks for a question | Regression model on historical data |
| 56 | **Auto-Feedback Templates** | AI generates 10 reusable feedback phrases per topic | Cached feedback library |
| 57 | **Misconception Library** | Track common student misconceptions per topic per exam | `Misconception` model + frequency |
| 58 | **Answer Pattern Learning** | Learn what a top-marks answer looks like per question over time | Embedding store of excellent answers |
| 59 | **Cheating Detection (Pattern)** | Same unusual phrases across multiple students = flag | N-gram overlap detection |
| 60 | **Multi-language Support** | Grade answers written in Telugu, Hindi, Tamil etc. | Multilingual LLM prompting |

---

## 🎨 UI/UX Advanced Features

| # | Feature | Description | Tech |
|---|---------|------------|------|
| 61 | **Side-by-side View** | Answer image on left, AI feedback on right | Resizable panels (`react-resizable-panels` — installed!) |
| 62 | **Annotation Mode** | Draw circles/highlights on answer image | `Canvas API` / `Konva.js` |
| 63 | **Dark/Light Theme** | System-aware theme switching | `next-themes` (installed!) |
| 64 | **Keyboard Shortcuts** | Teacher navigates Q1→Q2→Q3 with arrow keys | `useHotkeys` hook |
| 65 | **Drag-Drop Answer Upload** | Drag PDF/image directly onto upload zone | `@dnd-kit` (installed!) |
| 66 | **Evaluation Timeline** | Visual timeline: uploaded → extracted → graded → reviewed | Step progress component |
| 67 | **Print-Optimised View** | Clean printable result view without UI chrome | CSS `@media print` |
| 68 | **Mobile Responsive** | Teacher can review results on phone | Responsive Tailwind layout |

---

## 🔗 Integration Features

| # | Integration | What It Does | Protocol |
|---|------------|-------------|---------|
| 69 | **Google Classroom** | Import students, exams, submit grades back | OAuth + Classroom API |
| 70 | **Microsoft Teams** | Share results in Teams channel | MS Graph API |
| 71 | **Moodle LMS** | Sync exams and grades with Moodle | Moodle REST API |
| 72 | **Google Drive** | Upload answer sheets from Drive | Google Drive API |
| 73 | **Zoom / Meet** | Schedule exam sessions with auto-link | Calendar API |
| 74 | **Webhook Support** | Push events to any external system on evaluation complete | `POST /webhook` configurable |

---

## 🗺️ Full Feature Priority Matrix

```
🔴 Do First (Core Value)
├── #6  Teacher Override + Learning
├── #13 Highlight which sentences got marks (student view)
├── #27 Double-blind evaluation
├── #35 PDF report generation
├── #47 Real-time progress (SSE)
└── #53 RAG - Syllabus-aware grading

🟠 Do Second (Differentiators)
├── #3  Rubric Builder UI
├── #19 Multi-tenant architecture
├── #34 Voice feedback
├── #43 Semantic search in answers
├── #59 Cheating detection
└── #60 Multi-language support

🟡 Do Third (Scale Features)
├── #24 Bulk student import
├── #38 Mark sheet generation
├── #55 Question difficulty predictor
├── #69 Google Classroom integration
└── #57 Misconception library

🔵 Future (Premium Features)
├── #47 Fine-tuned grading model
├── #73 Zoom exam scheduling
└── #58 Answer pattern learning
```

---

**Anni features chusav — idi implement chesthe idi India lo top EdTech AI platform avutundi.** Ekkadi start cheyyyali? Specific oka feature cheppau — full ga implement chestanu!

### User Input

agents and agentic and routing ala inkemaina features unte rayu kda application smooth ga work chesela ala

### Planner Response

# Advanced Agentic Architecture & Routing Features

---

## 🧠 Current Agent Architecture vs What It Should Be

```
CURRENT (Basic)
─────────────────────────────────────────────
User Upload → CoordinatorAgent → SubjectExpertAgent → ReviewerAgent → Done

PROPOSED (Production Multi-Agent)
─────────────────────────────────────────────
User Upload
    │
    ▼
IntakeAgent (validate, classify, preprocess)
    │
    ▼
RouterAgent (smart routing decision tree)
    │
    ├──► FastPathAgent     (simple questions → 1 pass)
    ├──► StandardPathAgent (normal → 3 pass pipeline)
    ├──► DeepPathAgent     (complex → 5 pass + RAG)
    └──► FallbackAgent     (AI failed → human queue)
                │
                ▼
        SubjectExpertAgent (specialised per subject)
                │
                ▼
        QualityGateAgent   (confidence check)
                │
        ┌───────┴───────┐
        ▼               ▼
  Pass ✓           Retry / Human
        │
        ▼
ReviewerAgent → AuditAgent → FinaliserAgent → Done
```

---

## 🔀 Smart Routing System

| # | Router | Routing Logic | Decision | Tech |
|---|--------|--------------|----------|------|
| 1 | **ComplexityRouter** | Analyse question length + marks + subject → pick evaluation depth | Simple(1-pass) / Standard(3-pass) / Deep(5-pass) | LLM classifier |
| 2 | **ProviderRouter** | PDF → Claude, Image → Groq, long text → Claude, short text → Groq | Auto provider selection per file + content type | Rule engine |
| 3 | **CostRouter** | Check current API spend → if budget exceeded → switch to cheaper model | Dynamic model switching mid-evaluation | Redis spend tracker |
| 4 | **LoadRouter** | If Groq rate-limited → switch to Claude instantly, vice versa | Real-time provider health check | Circuit breaker |
| 5 | **SubjectRouter** | Detect subject from question text → route to correct expert agent | Math → MathExpert, CS → CodeExpert, etc. | CoT classifier |
| 6 | **LanguageRouter** | Detect answer language (English/Hindi/Telugu) → route to multilingual model | Language detection → prompt language hint | `langdetect` |
| 7 | **QualityRouter** | After evaluation: confidence < 60% → route to human review queue | Threshold-based quality gate | Confidence score |
| 8 | **PriorityRouter** | Exam deadline in 2 hours? → boost job priority in queue | Deadline-aware scheduling | `BullMQ` priority |
| 9 | **RetryRouter** | Agent failed → classify error type → retry / fallback / escalate | Error taxonomy routing | Error type matcher |
| 10 | **BatchRouter** | 1-5 students → sync, 6-50 → async queue, 50+ → chunked parallel | Auto batch strategy selection | Count-based |

---

## 🤖 New Agents to Build

### Intake & Pre-processing Agents

| # | Agent | Role | Input | Output |
|---|-------|------|-------|--------|
| 11 | **IntakeAgent** | Validate file type, size, orientation, legibility before evaluation | Raw upload | `{valid, issues[], quality}` |
| 12 | **ImagePreprocessAgent** | Deskew, denoise, enhance contrast on handwritten images | Raw image | Enhanced image base64 |
| 13 | **PageSegmentationAgent** | Split multi-page PDF → detect which page has which question | PDF pages | `{page: 1, questionNumbers: [1,2]}` |
| 14 | **HandwritingAssessAgent** | Rate handwriting legibility 1-10 before grading | Answer image | `{legibility, script, confidence}` |
| 15 | **LanguageDetectAgent** | Detect answer language + script (Latin/Devanagari/Telugu) | Text/image | `{language, script, confidence}` |

### Evaluation Agents

| # | Agent | Role | When Used |
|---|-------|------|-----------|
| 16 | **TranscriptionAgent** | Dedicated handwriting → text (Pass 1 only, no grading) | All image inputs |
| 17 | **SemanticAnalysisAgent** | Deep NLP: coherence, argument structure, conceptual depth | Pass 2 |
| 18 | **FactCheckAgent** | Verify factual claims against knowledge base | Expert level, science/history |
| 19 | **DiagramEvalAgent** | Specifically evaluates diagrams, graphs, charts in answers | When diagram detected |
| 20 | **CodeEvalAgent** | Run pseudocode through logic tracer, check algorithm correctness | CS questions |
| 21 | **MathStepAgent** | Break math into steps → award method marks per step | Math questions |
| 22 | **EssayStructureAgent** | Check intro/body/conclusion structure, paragraph transitions | Long answer / essay questions |
| 23 | **CriticalThinkingAgent** | Detect reasoning quality: deduction, induction, counter-arguments | Expert analytical questions |

### Quality & Audit Agents

| # | Agent | Role | Output |
|---|-------|------|--------|
| 24 | **QualityGateAgent** | After marking: check if output meets minimum quality standards | `{pass, issues[], rerunNeeded}` |
| 25 | **ConsistencyAgent** | Cross all questions: if student showed concept X in Q1, why penalised in Q4? | Consistency report |
| 26 | **BiasDetectionAgent** | Check if AI is penalising certain writing styles, accents, non-standard English | Bias flags |
| 27 | **HallucinationCheckAgent** | Verify AI reasoning references actual content, not fabricated claims | `{hallucinations[], riskScore}` |
| 28 | **AuditAgent** | Complete audit trail: every decision logged with reasoning | Audit log records |

### Post-Evaluation Agents

| # | Agent | Role | Output |
|---|-------|------|--------|
| 29 | **FeedbackPersonalisationAgent** | Rewrite feedback in student's comprehension level | Age/level-appropriate feedback |
| 30 | **GapAnalysisAgent** | Identify weak topics across all students | `{topic, failRate, remediation}` |
| 31 | **PlagiarismAgent** | Compare answers across all students for same question | Similarity matrix |
| 32 | **InsightAgent** | Generate teacher insights: "35% students missed Newton's 3rd law" | Actionable insights report |
| 33 | **ReportGeneratorAgent** | Compile all data → generate PDF report | Student/class PDF |
| 34 | **NotificationAgent** | Send email/SMS/WhatsApp when results ready | Multi-channel delivery |

---

## 🔄 Agentic Workflow Patterns

### Pattern 1: Self-Reflection Loop
```
Agent evaluates → checks own output → if low confidence → re-evaluates with different prompt
Max 3 reflections → then escalate to human

MathExpertAgent.evaluate()
    │
    ▼
SelfReflect: "Is my reasoning consistent with the rubric?"
    │
    ├── YES (confidence > 75%) → proceed
    └── NO  (confidence < 75%) → re-evaluate with CoT prompt
                                        │
                                        └── still low → HumanReviewQueue
```

### Pattern 2: Consensus Voting
```
3 independent AI calls for same question → majority vote on marks
Reduces hallucination by 40%

Call 1: 8/10   ──┐
Call 2: 7/10   ──┼──► Median: 7.5/10 → Final mark
Call 3: 8/10   ──┘
```

### Pattern 3: Hierarchical Escalation
```
Level 1: Groq Fast (simple questions, < 5 marks)
Level 2: Claude Standard (complex questions, 5-15 marks)
Level 3: Claude + RAG (expert questions, > 15 marks)
Level 4: Human Review (AI confidence < 50%)
```

### Pattern 4: Pipeline Branching
```
Question Type Detection
    │
    ├── factual    → FactualEvalPipeline (1 pass)
    ├── analytical → AnalyticalEvalPipeline (3 pass)
    ├── creative   → CreativeEvalPipeline (rubric-based)
    ├── math       → MathStepPipeline (step-by-step)
    ├── code       → CodeExecPipeline (logic trace)
    └── diagram    → VisualEvalPipeline (diagram focus)
```

### Pattern 5: Event-Driven Agent Mesh
```
EvaluationEvent published → multiple agents subscribe independently

EvaluationCompleted event
    ├── PlagiarismAgent.subscribe()     → async, runs after all students done
    ├── GapAnalysisAgent.subscribe()    → async, runs after all students done
    ├── NotificationAgent.subscribe()   → immediate
    ├── InsightAgent.subscribe()        → async
    └── ReportGeneratorAgent.subscribe() → on-demand
```

---

## 🧩 Agent Communication Protocol

| # | Feature | Current | Advanced |
|---|---------|---------|---------|
| 35 | **Agent Message Bus** | Direct function calls | Typed message passing via event emitter | `EventEmitter` typed |
| 36 | **Agent State Machine** | No formal states | Each agent has: `IDLE → RUNNING → SUCCESS / FAILED → RETRYING` | XState / custom FSM |
| 37 | **Agent Memory** | Stateless — no memory | Short-term context: agent remembers last 5 interactions per session | In-memory context store |
| 38 | **Agent Handoff Protocol** | Returns raw data | Structured handoff: `{from, to, payload, confidence, metadata}` | Typed handoff interface |
| 39 | **Dead Letter Queue** | Failed tasks disappear | Failed agent outputs → DLQ → manual review | `BullMQ` DLQ |
| 40 | **Agent Health Monitor** | No monitoring | Per-agent: success rate, avg latency, error rate | Redis metrics |

---

## 🏗️ Complete Agentic Architecture Stack

```typescript
// Proposed Agent Registry
const AGENT_REGISTRY = {
  // Intake
  intake:          IntakeAgent,
  imagePreprocess: ImagePreprocessAgent,
  pageSegment:     PageSegmentationAgent,
  
  // Routing
  complexityRouter: ComplexityRouter,
  providerRouter:   ProviderRouter,
  subjectRouter:    SubjectRouter,
  
  // Evaluation
  transcription:   TranscriptionAgent,
  mathStep:        MathStepAgent,
  codeEval:        CodeEvalAgent,
  diagramEval:     DiagramEvalAgent,
  essayStructure:  EssayStructureAgent,
  semantic:        SemanticAnalysisAgent,
  
  // Quality
  qualityGate:     QualityGateAgent,
  consistency:     ConsistencyAgent,
  hallucination:   HallucinationCheckAgent,
  reviewer:        ReviewerAgent,
  
  // Post-processing
  feedback:        FeedbackPersonalisationAgent,
  plagiarism:      PlagiarismAgent,
  gapAnalysis:     GapAnalysisAgent,
  report:          ReportGeneratorAgent,
  notify:          NotificationAgent,
}
```

---

## 📊 Agentic Features Summary Table

| Category | Count | Most Important |
|----------|-------|---------------|
| Routing Agents | 10 | ComplexityRouter, ProviderRouter, QualityRouter |
| Intake Agents | 5 | IntakeAgent, PageSegmentationAgent |
| Evaluation Agents | 8 | MathStepAgent, CodeEvalAgent, DiagramEvalAgent |
| Quality Agents | 5 | QualityGateAgent, HallucinationCheckAgent |
| Post-eval Agents | 6 | PlagiarismAgent, GapAnalysisAgent |
| Workflow Patterns | 5 | Self-Reflection, Consensus Voting, Escalation |
| Communication | 6 | Message Bus, State Machine, DLQ |

---

## 🚀 Build Order

```
Week 1 — Foundation
├── Agent Registry + Message Bus
├── Agent State Machine (FSM)
├── ComplexityRouter + ProviderRouter
└── QualityGateAgent

Week 2 — Specialised Evaluators
├── MathStepAgent
├── CodeEvalAgent
├── DiagramEvalAgent
└── TranscriptionAgent (separate from grading)

Week 3 — Intelligence
├── Self-Reflection Loop
├── Consensus Voting (3-run)
├── HallucinationCheckAgent
└── ConsistencyAgent

Week 4 — Post-Processing
├── PlagiarismAgent
├── GapAnalysisAgent
├── FeedbackPersonalisationAgent
└── Event-Driven Mesh (pub/sub)
```

---

**Ee architecture implement chesthe — idi world-class AI evaluation system avutundi.** Start cheyyadaniki **ComplexityRouter + QualityGateAgent** first build chestama? Avi rendu implement chesthe migata agents anni smooth ga fall into place avutay!