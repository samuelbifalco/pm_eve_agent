# Product Management Assistant (Eve)

> **Getting started:** see the main [README.md](README.md) for install and run steps. This file has deeper tool, API, and example-prompt documentation.

A filesystem-first Eve agent prototype that helps product managers triage feedback, score opportunities, draft PRDs, build action plans, search mock issues, persist decision logs, and demonstrate human-approval gating.

Licensed under the [MIT License](LICENSE).

## Companion PDF

A polished mini-course version of this walkthrough is available here:

[Download the Eve PM Assistant Mini-Course PDF](docs/assets/Eve_PM_Assistant_Mini_Course.pdf)

## What was built

| Path | Purpose |
|------|---------|
| `agent/instructions.md` | Senior PM system prompt |
| `agent/agent.ts` | Eve agent config (OpenAI `gpt-5`) |
| `agent/tools/ingest_feedback.ts` | Normalize raw feedback with keyword categorization |
| `agent/tools/score_opportunities.ts` | RICE-like opportunity scoring |
| `agent/tools/generate_prd.ts` | Structured PRD markdown generator |
| `agent/tools/create_action_plan.ts` | Milestone-based execution plans |
| `agent/tools/mock_linear_search.ts` | Mock issue search (no external APIs) |
| `agent/tools/save_decision_log.ts` | Persist decisions to sandbox `decision-logs/` |
| `agent/tools/risky_delete_or_archive.ts` | Approval-gated simulated destructive action |
| `agent/channels/eve.ts` | Built-in HTTP channel (from scaffold) |
| `web/` | Browser chat UI (static page + local proxy server) |

## Prerequisites

- Node.js **24.x**
- npm

## Environment variables

The agent uses direct OpenAI via `@ai-sdk/openai`:

```bash
# .env.local
OPENAI_API_KEY=sk-...
```

To switch to Vercel AI Gateway instead, change `agent/agent.ts` to a gateway model id (e.g. `"anthropic/claude-sonnet-4.6"`) and set:

```bash
AI_GATEWAY_API_KEY=...
# or
VERCEL_OIDC_TOKEN=...  # via vercel link
```

## Run locally

### Terminal TUI (Eve agent)

```bash
npm install
npm run dev
```

This starts the Eve dev server and opens the interactive terminal UI. Check the terminal for the HTTP URL (commonly `http://127.0.0.1:2000`).

### Browser UI

Run **two terminals**:

```bash
# Terminal 1 — Eve agent (TUI + HTTP API)
npm run dev

# Terminal 2 — PM Assistant web UI (set EVE_BASE_URL to match Terminal 1)
EVE_BASE_URL=http://127.0.0.1:2000 npm run dev:ui
```

Open **http://127.0.0.1:3001** in your browser.

The UI server serves `web/public/` and proxies `/eve/*` to the Eve dev server. No API keys are sent to the browser.

Optional env vars for the UI server:

```bash
EVE_BASE_URL=http://127.0.0.1:2000   # default
UI_PORT=3001                          # default
```

Quick actions insert prompt templates into the textarea (they do not auto-send). Use **Send** or `Cmd/Ctrl+Enter` to submit.

### Other scripts

```bash
npm run typecheck   # TypeScript check (agent + web)
npm run build:ui    # Compile web/src/app.ts -> web/public/app.js
npm run dev:ui      # Build UI client + start browser server on :3001
npm run build       # Compile agent to .eve/
npm run start       # Serve built output
```

## HTTP API examples

Create a session:

```bash
curl -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Hello — triage this feedback: enterprise admins say onboarding is confusing."}'
```

Stream the session (use `x-eve-session-id` from the create response):

```bash
curl http://127.0.0.1:2000/eve/v1/session/<sessionId>/stream
```

Continue the conversation:

```bash
curl -X POST http://127.0.0.1:2000/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -d '{"continuationToken":"<token>","message":"Score HubSpot integration vs onboarding checklist."}'
```

## Example prompts

### 1. Triage feedback

> I have feedback from three customers: enterprise admins say onboarding is confusing, two users reported slow dashboard load times, and one prospect needs HubSpot integration before buying. Triage this and recommend what to do first.

### 2. Score opportunities

> Score these opportunities: HubSpot integration, faster dashboard loading, self-serve onboarding checklist, and admin audit logs. Use reach 8/6/9/4, impact 7/8/9/5, confidence 0.7/0.8/0.85/0.6, effort 8/5/4/6 respectively.

### 3. Create a PRD

> Create a PRD for a self-serve onboarding checklist for new enterprise admins.

### 4. Action plan

> Create an action plan to launch a beta in 3 weeks with one engineer, one designer, and me as PM.

### 5. Mock issue search

> Search mock issues for onboarding and summarize what is blocking launch.

### 6. Decision log

> Save a decision log that we are prioritizing onboarding checklist over HubSpot integration because activation is currently the biggest blocker.

## Refinement notes

- The agent avoids inventing exact calendar dates unless the user provides a deadline, launch date, sprint start, or planning window. Otherwise it uses relative timing ("this sprint," "within 2 weeks," etc.).
- Signal labels from `ingest_feedback` are normalized human-readable `snake_case` (e.g. `activation_risk`, `deal_blocker_potential`, `enterprise_segment`).
- When prioritization inputs are missing, the agent states assumptions explicitly and labels them as adjustable before calling `score_opportunities`.

## UI limitations

- The browser UI is a local prototype: static HTML/CSS + TypeScript client, proxied to Eve over HTTP.
- Streaming parses Eve NDJSON events; tool calls appear when `actions.requested` events are emitted.
- Human-in-the-loop approval flows (e.g. `risky_delete_or_archive`) are not fully wired in the UI yet — use the Eve TUI for approval testing.
- `npm run dev` (Eve TUI) is unchanged; the UI is an optional second process on port 3001.

## Limitations

- Feedback categorization uses simple keyword heuristics, not ML.
- `mock_linear_search` returns hardcoded sample issues only.
- `risky_delete_or_archive` is simulated and approval-gated — it does not delete data.
- Decision logs are written to the per-session Eve sandbox (`/workspace/decision-logs/`), not the app repo.
- Requires a valid model API key to run end-to-end.

## Suggested follow-ups

- Replace mock Linear search with a real Linear/GitHub integration.
- Add seeded `agent/sandbox/workspace/` templates for PRD/decision log starters.
- Add `--channel-web-nextjs` for a browser chat UI.
- Persist decision logs to a durable store outside the sandbox if cross-session retrieval is needed.
