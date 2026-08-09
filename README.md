# Ovia

Investigational, patient-facing screening-support prototype. A structured questionnaire plus an optional de-identified pelvic ultrasound still, returning **three independent risk assessments** — PCOS, ovarian cyst, ovarian tumor — that are never combined into one score.

**Ovia does not diagnose or exclude any condition. Every case is directed to clinician review.**

Start with [`AGENT.md`](AGENT.md) — it routes to every canonical document and defines source precedence.

| I need | Read |
|---|---|
| Why this exists, scope, demo | [`.agent/product-brief.md`](.agent/product-brief.md) |
| What it does and must never do | [`.agent/product-requirements.md`](.agent/product-requirements.md) |
| How the frontend is built | [`.agent/frontend-architecture.md`](.agent/frontend-architecture.md) |
| How it looks and behaves | [`.agent/design-guidelines.md`](.agent/design-guidelines.md) |
| What to build next | [`.agent/implementation-plan.md`](.agent/implementation-plan.md) |
| Whether a fact is usable | [`.agent/evidence-register.md`](.agent/evidence-register.md) |

**No accuracy, sensitivity, specificity, or AUROC figure appears in this repository until it traces to a recorded reproducible run.**
## Run the complete container stack

```powershell
docker compose up -d --build
```

The loopback gateway is available at `http://127.0.0.1:8088/ovia/`. In production, the existing HTTPS server proxies that path to `https://daffatrg.me/ovia/` without replacing the website at `/`. The stack includes an Nginx gateway, production React frontend, Rust API, and one isolated container per model. See [container deployment](docs/deployment.md) for CPU/GPU commands, the host Nginx snippet, failure behavior, and security boundaries.

## Playwright end-to-end tests

With the Compose stack running:

```powershell
cd test
npm install
npx playwright install chromium
npm test
```

The local specs cover both browser flows and the public backend contract. The complete `test/` workspace is excluded by `.gitignore` as a local verification harness.
