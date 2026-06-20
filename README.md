# PM Assistant (Eve)

A filesystem-first [Eve](https://github.com/vercel/eve) agent that helps product managers triage feedback, score opportunities, draft PRDs, build action plans, search mock issues, and save decision logs.

It includes both the Eve terminal TUI and a lightweight local browser UI.

**License:** This project is open source under the [MIT License](LICENSE). You're free to use, modify, and adapt it for your own Eve agent workflows.

## What you get

- **Eve agent** — PM-focused instructions, typed tools, durable sessions, and direct OpenAI support through `@ai-sdk/openai`
- **Custom PM tools** — feedback triage, opportunity scoring, PRD drafting, action planning, mock issue search, and decision logging
- **Terminal UI** — run the Eve dev TUI with `npm run dev`
- **Browser UI** — local chat interface at http://127.0.0.1:3001 with quick-action prompt templates
- **Local-first setup** — API keys stay server-side in `.env.local`

See [DETAILED_GUIDE.md](DETAILED_GUIDE.md) for detailed tool behavior, example prompts, HTTP API examples, and limitations.

## Mini-Course PDF

Want the full walkthrough as a polished teaching asset?

[Download the Eve PM Assistant Mini-Course PDF](docs/assets/Eve_PM_Assistant_Mini_Course.pdf)

## Prerequisites

- **Node.js 24.x**
- **npm**
- An **OpenAI API key**

This project uses direct OpenAI provider configuration in `agent/agent.ts`. You can switch to another Eve-supported provider if needed.

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/pm-assistant-eve.git
cd pm-assistant-eve
npm install
```

Replace the clone URL and `cd` folder name with your fork or local repo directory if they differ.

### 2. Configure credentials

Create `.env.local` in the project root:

```bash
OPENAI_API_KEY=sk-your-key-here
```

**Never commit `.env.local`.**

This repo's `.gitignore` already excludes env files (`.env*`), which covers `.env.local`. Do not remove that entry.

### 3. Run the Eve agent

```bash
npm run dev
```

This starts the Eve dev server and opens the Eve terminal TUI.

The Eve HTTP API usually runs at:

**http://127.0.0.1:2000**

Check your terminal output if your local port is different.

### 4. Run the browser UI

Open a second terminal and run:

```bash
EVE_BASE_URL=http://127.0.0.1:2000 npm run dev:ui
```

Then open:

**http://127.0.0.1:3001**

Use the textarea to send prompts, or click a quick-action button to insert a prompt template.

### macOS Homebrew Node 24

If you installed Node 24 with Homebrew and do not want to change your global Node version, run commands with a temporary PATH override:

```bash
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run dev
```

For the browser UI:

```bash
EVE_BASE_URL=http://127.0.0.1:2000 PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run dev:ui
```

### If you are on Node 23

Eve requires **Node 24 or newer**.

Check your version:

```bash
node -v
```

If you see Node 23, install Node 24.

With Homebrew:

```bash
brew install node@24
```

Then run this project with the Node 24 PATH override:

```bash
PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run dev
```

Or use nvm:

```bash
nvm install 24
nvm use 24
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the Eve agent, terminal TUI, and HTTP API |
| `npm run dev:ui` | Starts the browser UI on port 3001 |
| `npm run build` | Builds the Eve agent output to `.eve/` |
| `npm run build:ui` | Compiles `web/src/app.ts` to `web/public/app.js` |
| `npm run typecheck` | Typechecks the Eve agent and browser UI |
| `npm run start` | Serves the built Eve output |

## UI environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `EVE_BASE_URL` | `http://127.0.0.1:2000` | Eve HTTP API URL used by the browser UI proxy |
| `UI_PORT` | `3001` | Browser UI port |

API keys stay server-side in `.env.local`. They are not exposed to the browser.

## Project layout

```
agent/
  agent.ts              # Model config
  instructions.md       # Product-management system prompt
  tools/                # PM tools
  channels/eve.ts       # Eve HTTP channel
web/
  server.ts             # Static UI server and /eve/* proxy
  src/app.ts            # Browser chat client
  public/               # HTML, CSS, compiled app.js
```

## Included tools

- **`ingest_feedback`** — normalizes raw feedback into categories, severity, and signals
- **`score_opportunities`** — scores product opportunities with a RICE-like model
- **`generate_prd`** — drafts a structured PRD in Markdown
- **`create_action_plan`** — creates milestones, tasks, risks, and next steps
- **`mock_linear_search`** — returns mock product issue data for local demos
- **`save_decision_log`** — saves a decision log entry to the Eve sandbox
- **`risky_delete_or_archive`** — demonstrates human approval gating with a simulated destructive action

## Example prompts

- Triage this feedback: enterprise admins say onboarding is confusing, two users reported slow dashboards, and one prospect needs HubSpot before buying.
- Use the `score_opportunities` tool to score HubSpot integration, dashboard performance, self-serve onboarding, and admin audit logs.
- Create a PRD for a self-serve onboarding checklist for enterprise admins.
- Create an action plan to launch a beta in 3 weeks with one engineer, one designer, and one PM.

More examples are available in [DETAILED_GUIDE.md](DETAILED_GUIDE.md).

## Security notes

- Do not commit `.env.local`
- Do not put API keys in browser/client code
- Keep model credentials server-side only
- Review approval-gated tools before adapting this for real destructive workflows

## Limitations

This is a **local prototype and learning template**.

- The Linear/GitHub issue search tool uses mock data
- Feedback triage uses deterministic keyword logic
- Decision logs are saved to the Eve sandbox, not the git repo
- The browser UI is intentionally simple
- Human-in-the-loop approval is best tested through the Eve terminal TUI

## License

MIT — see [LICENSE](LICENSE).
