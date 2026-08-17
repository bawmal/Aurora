---
name: testing-aurora
description: How to run and test the Aurora seller app locally — the analyser at `/` and the coached journey at `/journey` — including the isolated-server trick, the localStorage state key, and how to derive expected projection figures instead of trusting the UI.
---

# Testing Aurora locally

## Running a server you can trust

- Two `next dev` processes sharing one checkout corrupt `.next` and make every page return
  HTTP 500 with an `ENOENT … _buildManifest.js.tmp` error. If another agent or session may be
  running the repo's own dev server, test from a **copy of the tree**:

  ```bash
  rm -rf /home/ubuntu/aurora-test && mkdir -p /home/ubuntu/aurora-test
  cd /home/ubuntu/repos/Aurora && tar --exclude=.next --exclude=.git -cf - . \
    | (cd /home/ubuntu/aurora-test && tar -xf -)
  ```

  `node_modules` copies across, so no install is needed.

- A plain backgrounded `next dev` **does not survive the shell that started it** — the page will
  be `ERR_CONNECTION_REFUSED` by the time the browser opens. Always detach it:

  ```bash
  cd /home/ubuntu/aurora-test \
    && nohup setsid npx next dev --turbopack -p 3001 > /tmp/dev.log 2>&1 < /dev/null &
  ```

  Then poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/journey` before driving
  the browser. Turbopack compiles a route on first request, so the first load takes ~5s.

- Live Keepa testing needs `KEEPA_API_KEY` in the dev server's env. `KEEPA_BASE_URL` can point the
  client at a local fixture server for zero-token testing of shapes the live product does not have
  (e.g. missing months). Without a key the analyser degrades to a manual-entry path, which is itself
  worth testing.

## `/journey` state

All journey state is one `localStorage` key: `aurora-journey-v1`. There is no server state and no
login anywhere in the app.

- Fresh seller: `localStorage.removeItem("aurora-journey-v1")` then reload. This is the only way to
  get the first module back, and several behaviours branch on it (e.g. the Profile disclosure opens
  on a first visit and starts closed for a returning seller).
- Corrupt-state fallback can be exercised by setting the key to `{"profile":{"residency":"Mars"}}`
  or to non-JSON garbage; the page should fall back to defaults rather than blanking.
- Using the console for storage manipulation is fine; do everything else (clicking, typing,
  navigating) through real UI interactions so the recording stays legible.

## Derive expected numbers, never read them off the screen

The projection is pure and cheap to recompute, so assert against your own arithmetic. Put a scratch
`.ts` file **inside the repo copy** (relative imports resolve there; `npx tsx /tmp/foo.ts` fails
with MODULE_NOT_FOUND) and delete it afterwards:

```ts
import { projectYear, reachability } from "./lib/domain/projection"
const inp = { capital: 2000, targetRoi: 0.3, turnsPerYear: 6, reinvestRate: 0.5 }
console.log(projectYear(inp), reachability(inp, 2000, 12, "CAD"))
```

The same trick enumerates the module sequence a profile will actually walk, which tells you how many
completion clicks are needed to reach a specific module:

```ts
import { nextMove, completeMilestone, resolveGuidance } from "./lib/domain/journey"
```

Useful landmarks (defaults CA / capital 2000 / minROI 30%):
- 6 turns / 50% reinvest → 603.41 / 4626.12 / 5252.24, target 2000 arrives month 30.
- 12 turns / 100% → 10752.96 / 46596.17 / 44596.17. These are *defaults*, not caps — the assumptions
  behind "Change assumptions" can still reach them, and that is worth asserting after any
  recalibration.
- The UI rounds display figures to whole currency units, so expect `CAD 603`, not `CAD 603.41`.

## Things that have broken before — check them after any related change

- **Text-vs-number round-trips.** Numeric profile fields are stored as numbers and rebuilt as text on
  load, which has produced `7.000000000000001` in the Minimum ROI field after a reload. Test each
  field by typing a value, reloading, and comparing the exact string — mid-edit correctness is not
  enough.
- **Currency threading.** Metrics, the sentence and the *workings* are formatted in different places;
  the workings once hardcoded `$` under GBP metrics. Check all three marketplaces (Amazon Canada /
  US / UK → CAD / USD / GBP) and grep the rendered page for a stray `$`.
- **`{marketplace}` template leakage.** Per-marketplace milestone names and guidance contain a
  `{marketplace}` placeholder substituted with a seller-facing label ("Amazon UK"). Any code path
  that renders a milestone name without going through the substitution helper will print the raw
  placeholder. A cheap page-wide check after switching marketplace:

  ```js
  const t = document.body.innerText
  t.match(/\{marketplace\}/g)          // must be null
  t.match(/amazon\.(ca|com|co\.uk)/gi) // must be null in seller-facing text
  ```

  Expand every `<details>` first, since the leak has appeared inside collapsed gate panels rather
  than on the landing screen.
- **Controlled `<details open={state}>` with no `onToggle`.** A re-render re-pins the disclosure, so a
  panel can snap shut on a keystroke. When testing an input inside a disclosure, type
  character-by-character and confirm the panel is still open after each one, in both the
  fresh-visit and returning-visit states.

## Devin secrets needed

- `KEEPA_API_KEY` — live product lookups on `/`. Not needed for `/journey`, and not needed for the
  analyser's manual-entry path.
