# Ovia — frontend

The participant-facing screening flow: eligibility gate → questionnaire →
optional ultrasound → review and consent → three independent results.

**Ovia does not diagnose or exclude any condition. Every case is directed to
clinician review.** The safety rules below are not style preferences — they are
enforced in code, and changing them needs a signed decision, not a pull request.

Product and safety canon lives in [`.agent/`](../.agent/), routed from
[`.agent/AGENT.md`](../.agent/AGENT.md). This file covers only how to run and change the app.

---

## Running it

### 1. Prerequisites

Node 20.19+ or 22.12+ (Vite 7 requires it; this repo is developed on Node 24)
and npm. Nothing else — no database, no backend, no Docker.

```bash
node -v
```

### 2. Install

```bash
cd FE
npm install
```

### 3. Start the dev server

```bash
npx vite
```

Open **http://localhost:5173**. That's it — the app runs fully offline against
fixtures, so you do not need the backend to click through every screen.

> **Two things that will bite you:**
>
> **Use `npx vite`, not `npm run dev`.** The scripts in `package.json` set
> `NODE_OPTIONS` with POSIX inline syntax (`NODE_OPTIONS="…" vite`), which is a
> parse error in PowerShell. Either call `npx vite` directly, or run the npm
> script from Git Bash / WSL.
>
> **Hot reload is off.** [`vite.config.ts`](vite.config.ts) sets `hmr: false`,
> so the page will not update itself when you save. Refresh the browser
> manually. This is deliberate — HMR was disabled for memory reasons — so don't
> "fix" it without checking why.

### 4. Drive the flow

The happy path is: splash → three eligibility questions → clinical questionnaire
→ ultrasound (skippable) → review and consent → results.

In dev builds a **demo drawer** sits at the bottom right. Open it to force any of
the seven backend outcomes before you submit, then hit submit to see that state
render:

| Outcome | What you should see |
|---|---|
| `all_scored` | three scored panels, inspection regions available |
| `image_skipped` | PCOS scored, two `not_screened` panels |
| `one_unavailable` | tumor panel fails alone; the other two are unaffected |
| `missing_calibration` | all three band-less, no numbers shown |
| `server_quality_rejection` | back to the ultrasound step with retake guidance |
| `retryable_timeout` | error notice on review with a "Try again" button |
| `terminal_version_mismatch` | terminal screen, no output, no retry |

"Reset session" in the same drawer clears state and returns to the start.

To exercise the ultrasound path you need any image file — it is never uploaded
anywhere in fixture mode.

### 5. Run against the Rust backend

```bash
cp .env.example .env.local
```

Then in `.env.local`:

```bash
VITE_OVIA_ADAPTER=live
VITE_OVIA_API_BASE_URL=http://127.0.0.1:8080
```

Restart the dev server — Vite reads env at startup, not per request. The demo
drawer's outcome picker has no effect in live mode; responses come from the
server. The backend must allowlist `http://localhost:5173` in its CORS config,
and must not use a credentialed wildcard. See
[`docs/api-contract.md`](../docs/api-contract.md).

### 6. Production build

```bash
npx vite build      # emits dist/
npx vite preview    # serves dist/ at http://localhost:4173
```

Env is baked in at build time, so build with the same `.env.local` you intend to
ship.

### Troubleshooting

| Symptom | Cause |
|---|---|
| `NODE_OPTIONS=... : The term is not recognized` | PowerShell running the npm script. Use `npx vite` |
| Saved a file, nothing changed | HMR is off by design. Refresh |
| `VITE_OVIA_API_BASE_URL is required` on submit | `VITE_OVIA_ADAPTER=live` with no base URL set |
| Submit hangs then fails with a network error | backend not running, or CORS not allowlisting the dev origin |
| Env change had no effect | restart the dev server; rebuild for `dist/` |
| Out-of-memory during build | raise the ceiling: `NODE_OPTIONS="--max-old-space-size=1024" npx vite build` |

---

## Verifying a change

There is **no test suite** — `playwright` is installed but no specs exist, and
there is no vitest, no lint script, and no typecheck script. "Verified" here
currently means:

```bash
npx tsc --noEmit          # 3 known pre-existing unused-variable errors
npx vite build
```

Anything beyond that is a manual click-through. Treat that as a gap, not a
standard.

---

## Stack

Vite 7 · React 18 · TypeScript 5.9 · Tailwind v4 (`@tailwindcss/vite`) ·
shadcn components on `@base-ui/react`.

Two things that will surprise you if you've read
[`.agent/frontend-architecture.md`](../.agent/frontend-architecture.md) first —
**the document describes a stack this app does not use**:

| The document says | What is actually built |
|---|---|
| Next.js App Router, file routing | Vite + a `Step` union and a `switch` in [`App.tsx`](src/App.tsx) |
| Zustand, memory-only | React Context + `useReducer`, persisted to `sessionStorage` |
| TanStack Query, React Hook Form, Zod | none — hand-rolled |
| shadcn/ui on Radix | shadcn on `@base-ui/react`; there is no `@radix-ui/*` dependency |
| Vitest, Testing Library, Playwright, axe, MSW | Playwright installed, unused |

Where the two disagree, this table describes reality. Neither has been
reconciled; see [Known gaps](#known-gaps).

There is no router. Adding a screen means adding to the `Step` union in
[`FormContext.tsx`](src/context/FormContext.tsx) **and** the `StepRouter` switch
in [`App.tsx`](src/App.tsx).

---

## Layout

```
src/
  App.tsx                  step router + app shell
  context/
    FormContext.tsx        answers, current step, sessionStorage persistence
    SubmissionContext.tsx  submit lifecycle: stages, timeouts, cancel, error routing
  lib/
    adapter/               the backend boundary — see below
    eligibility.ts         the three-question gate; first disqualifying answer wins
    riskLogic.ts           local placeholder scoring (see Known gaps)
  components/
    *.tsx                  screens
    *Copy.ts               participant-facing strings, held apart from components
    ui/                    shadcn primitives
```

Copy for the ineligible exits and the submission errors lives in
[`notEligibleCopy.ts`](src/components/notEligibleCopy.ts) and
[`submissionCopy.ts`](src/components/submissionCopy.ts) rather than inline. That
is deliberate: it makes the locked vocabulary greppable, and it is where the
Indonesian translations will pair when FE-9 lands.

---

## The backend boundary

Everything that talks to a server is behind one interface in
[`src/lib/adapter/`](src/lib/adapter/):

```ts
submit(input: SubmitInput, signal: AbortSignal): Promise<SubmitOutcome>
```

| File | Role |
|---|---|
| `types.ts` | domain types. **Frontend** types — no wire field names appear here |
| `wire.ts` | the only module that knows backend field names. Encode, decode, map errors |
| `httpAdapter.ts` | live transport |
| `fixtureAdapter.ts` | offline, deterministic, seven outcomes |
| `index.ts` | picks one from `VITE_OVIA_ADAPTER` |

The wire contract, including a Rust/serde sketch, is
[`docs/api-contract.md`](../docs/api-contract.md).

`getAdapterMode()` constant-folds at build time, so the fixture set and the HTTP
client never ship in the same bundle.

### Environment

| Variable | Default | Notes |
|---|---|---|
| `VITE_OVIA_ADAPTER` | `fixture` | `live` talks to the backend |
| `VITE_OVIA_API_BASE_URL` | — | required when `live`; no trailing slash |
| `VITE_OVIA_REQUEST_TIMEOUT_MS` | `60000` | per attempt; stays under the 90s hard timeout |

**No secret belongs in any `VITE_` variable.** They are compiled into the public
bundle and readable by anyone who loads the page. `.env` and `.env*.local` are
git-ignored; `.env.example` carries placeholders only.

---

## Rules the code enforces

Read these before changing a results, error, or image surface.

**Three independent outputs, no fusion.** PCOS, cyst, and tumor each resolve,
render, and fail on their own. `ResultPanels` is an object of three named fields
rather than an array *specifically* so nothing can `map` or `reduce` across them.
There is no combined "Ovia score" type anywhere, and no function takes more than
one result and returns a single value. Card order is fixed and never re-ranks.

**Skipping the image is a first-class state.** Questionnaire alone scores PCOS;
cyst and tumor need the image. Skipping yields one scored card and two
`not_screened` cards — never a blank, never an omission, and never anything that
reads as low or absent risk.

**No stale output survives a failure.** Starting a submission discards any prior
outcome, and the `error` state has no field capable of holding a result. The
clinician-review recommendation renders unconditionally, before any fetch
resolves and outside any animation gate.

**The sonogram is never altered.** No CSS filter, tint, blend mode, or opacity
touches the `<img>` in [`ImageViewer.tsx`](src/components/ImageViewer.tsx). The
inspection overlay is a sibling inside the transformed box, defaults **off**, and
carries a persistent non-causal caption.

**Prohibited vocabulary.** No malignancy call. No O-RADS category. No accuracy,
sensitivity, specificity, or AUROC figure anywhere in this repository until it
traces to a recorded reproducible run. The age hint must never say "validated".

**Neither answer on a binary question is pre-selected or visually favoured**, and
an ineligible exit is never framed as a health judgement — it always offers both
a route back (in case of a mis-tap) and a clinician route.

**Server prose is never shown to a participant.** The adapter reads `message`
from an error envelope and discards it; participant-facing text resolves from
`guidance_key` to local copy.

---

## Known gaps

Honest list. None of these are hidden behind a green checkmark elsewhere.

1. **`sessionStorage` contradicts the architecture.** `FormContext` persists the
   full form state under `ovia-form-state`, including the ultrasound as a data
   URL. `.agent/frontend-architecture.md` §1.5 requires patient data to be
   memory-only. This is the sharpest privacy edge in the app and will fail QA-3.
2. **Results cards are placeholder logic.** [`Results.tsx`](src/components/Results.tsx)
   still renders [`riskLogic.ts`](src/lib/riskLogic.ts) with Low/Moderate/Higher
   and a green tier — not the adapter's band output. FE-7 is formally blocked on
   UX-2 (traffic-light colours and result copy conflict with the safety rules
   above) and ARCH-3 (band thresholds). Until then the adapter's panels are
   decoded but not displayed.
3. **No tests.**
4. **`answers` on the wire is the form's internal shape** — camelCase, all
   strings. Marked provisional in the contract; pins on ARCH-1.
5. **Region labels are bare ordinals** ("Region A"). ARCH-4 owns imaging finding
   vocabulary; nothing may name a finding until it is signed.
6. **English only.** FE-9 pairs Indonesian.
7. **The clinician route is guidance copy, not a link** — no provider directory
   exists, and inventing one would be worse than the gap.
