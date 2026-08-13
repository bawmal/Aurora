# Seller Journey OS

An operating system for building an Amazon business: it maintains a structured model of the seller, computes what they should do next, tells them what a product is actually worth to them, and progressively transfers skill until they no longer need to be told.

## Getting started

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm test` | Domain tests and the mentor evaluation harness |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Architecture

```
lib/domain/     pure TypeScript. No I/O, no database, no framework imports.
                types.ts is the source of truth; Prisma follows it.
eval/           the feature-05 mentor evaluation harness
prisma/         state only — methodology lives in lib/domain
app/            Next.js App Router
```

Two rules do most of the work:

- **`lib/domain` stays pure.** Fee tables, the jurisdiction rules and the milestone library live in code, so CI validates them and a change shows up in review. The same functions run in the browser and on the server.
- **The database stores state, not methodology.** Provenance is recorded by dotted field path, so any value in a profile can answer who set it and when.

## Scope

v1 serves sellers resident in **Canada, the US and the United Kingdom**, selling on amazon.ca, amazon.com and amazon.co.uk. `Residency` is a closed union with no `OTHER` member, so an unsupported country is unrepresentable rather than a value the jurisdiction table has to defend against.

## Principles worth knowing before you change anything

- Show the arithmetic. A verdict without its working is not an answer.
- Verdict and confidence are separate. Never merge them into "strong buy".
- Every recommendation states at least one risk.
- Never invent seller state.
- Tax, legal, customs and policy questions route to official sources or a human. The product hands over the form; it does not give the ruling.
- No autonomous spending or purchasing, ever.
