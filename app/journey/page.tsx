import Link from "next/link"
import { Journey } from "./journey"

export default function JourneyPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-baseline justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Your next move</h1>
            <Link href="/" className="text-sm" style={{ color: "var(--accent)" }}>
              Product analyser
            </Link>
          </div>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--text-muted)" }}>
            A useful action now, and a transparent model of what the business could be worth.
          </p>
        </div>
      </header>
      <Journey />
    </main>
  )
}
