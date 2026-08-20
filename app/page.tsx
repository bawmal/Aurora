import { Analyser } from "./analyser"

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">What is this worth to you?</h1>
          <a href="/start" className="text-sm" style={{ color: "var(--accent)" }}>
            Start with the opportunity
          </a>
          <a href="/journey" className="text-sm" style={{ color: "var(--accent)" }}>
            Your journey
          </a>
        </div>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          No account, no setup. Put a product in and get a verdict with the arithmetic behind it.
        </p>
      </header>
      <Analyser />
    </main>
  )
}
