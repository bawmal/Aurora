import Link from "next/link"
import { Journey } from "./journey"

export default function JourneyPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            <Link href="/" style={{ color: "var(--accent)" }}>
              Product analyser
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your next move</h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--text-muted)" }}>
            A useful action now, and a transparent model of what the business could be worth.
          </p>
        </div>
      </header>
      <Journey />
    </main>
  )
}
