"use client"

import React from "react"

/**
 * Hand-drawn stand-ins for Amazon's own screens. They are deliberately
 * abstract — grey blocks where the photograph and the copy would be — because
 * a screenshot of a real listing ages badly, carries someone's delivery
 * address, and cannot highlight the one part that matters. Every one of these
 * is labelled as an illustration so nobody mistakes it for live data.
 */

export function Illustration({
  caption,
  children,
}: {
  caption: string
  children: React.ReactNode
}) {
  return (
    <figure className="grid gap-2">
      <div
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
      >
        {children}
      </div>
      <figcaption className="text-xs" style={{ color: "var(--text-faint)" }}>
        {caption}
      </figcaption>
    </figure>
  )
}

function Chrome({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-2"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--surface-sunken)",
      }}
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--hairline)" }}
          />
        ))}
      </span>
      <span
        className="data truncate text-[11px]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
    </div>
  )
}

function Thumb({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`grid place-items-center rounded-md ${tall ? "h-24" : "h-16"}`}
      style={{ background: "var(--surface-sunken)" }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className={tall ? "h-10 w-10" : "h-7 w-7"}
        fill="none"
        stroke="var(--text-faint)"
        strokeWidth="1.25"
      >
        <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5Z" />
        <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      </svg>
    </div>
  )
}

function Bar({ width, strong = false }: { width: string; strong?: boolean }) {
  return (
    <span
      className="block h-2 rounded-full"
      style={{
        width,
        background: strong ? "var(--hairline)" : "var(--surface-sunken)",
      }}
      aria-hidden
    />
  )
}

/** Four search results, four separate products — the point of the panel. */
export function SearchResultsIllustration({
  currency,
  items,
}: {
  currency: string
  items: { name: string; price: string }[]
}) {
  return (
    <Illustration caption="Illustration of an Amazon search results page.">
      <Chrome label="amazon.ca/s?k=cordless+drill" />
      <div className="p-3">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          2,000+ results
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.name}
              className="grid gap-2"
              style={{ gridTemplateRows: "auto 2.5rem auto auto" }}
            >
              <Thumb />
              <span className="text-[11px] leading-4">{item.name}</span>
              <span className="data text-xs font-semibold">
                {currency} {item.price}
              </span>
              <span
                className="justify-self-start rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  background: "var(--surface-sunken)",
                  color: "var(--text-muted)",
                }}
              >
                one page
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Illustration>
  )
}

/** A listing page with the Buy Box called out, because that is the whole idea. */
export function BuyBoxIllustration({
  currency,
  price,
  otherSellers,
}: {
  currency: string
  price: string
  otherSellers: number
}) {
  return (
    <Illustration caption="Illustration of one Amazon listing page.">
      <Chrome label="amazon.ca/dp/…" />
      <div className="grid gap-4 p-3 sm:grid-cols-[5rem_1fr_11rem]">
        <Thumb tall />
        <div className="grid content-start gap-2">
          <Bar width="90%" strong />
          <Bar width="65%" strong />
          <span className="data mt-1 text-lg font-semibold">
            {currency} {price}
          </span>
          <div className="mt-2 grid gap-1.5">
            <Bar width="80%" />
            <Bar width="72%" />
            <Bar width="55%" />
          </div>
        </div>
        <div className="grid content-start gap-2">
          <span
            className="justify-self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            about 90% of sales
          </span>
          <div
            className="grid gap-2 rounded-lg border p-3"
            style={{
              borderColor: "var(--accent)",
              background: "var(--accent-tint)",
            }}
          >
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Buy new
            </span>
            <span className="data text-base font-semibold">
              {currency} {price}
            </span>
            <span
              className="rounded-full px-3 py-1 text-center text-[11px] font-medium text-white"
              style={{ background: "var(--accent)" }}
            >
              Add to cart
            </span>
            <span
              className="rounded-full border px-3 py-1 text-center text-[11px]"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              Buy now
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Sold by one seller at a time
            </span>
          </div>
        </div>
      </div>
      <div
        className="border-t px-3 py-2 text-[11px]"
        style={{ borderColor: "var(--hairline)", color: "var(--text-muted)" }}
      >
        {otherSellers} other sellers offer the identical item on this same page.
      </div>
    </Illustration>
  )
}

/** What the page hides: who else is on it, at what price, and how often it sells. */
export function OffersIllustration({
  currency,
  rows,
  hiddenSellers,
  demandPerMonth,
}: {
  currency: string
  rows: { seller: string; price: string; share: number; you?: boolean }[]
  hiddenSellers: number
  demandPerMonth: number
}) {
  return (
    <Illustration caption="Illustration of the seller list behind one listing.">
      <div className="p-3">
        <div
          className="grid grid-cols-[1fr_5rem_8rem] gap-3 border-b pb-2 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ borderColor: "var(--hairline)", color: "var(--text-faint)" }}
        >
          <span>Seller</span>
          <span className="text-right">Price</span>
          <span>Share of the box</span>
        </div>
        <ul className="mt-2 grid gap-2">
          {rows.map((row) => (
            <li
              key={row.seller}
              className="grid grid-cols-[1fr_5rem_8rem] items-center gap-3 text-xs"
              style={row.you ? { color: "var(--accent)" } : undefined}
            >
              <span className="truncate">{row.seller}</span>
              <span className="data text-right">
                {currency} {row.price}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="h-2 flex-1 overflow-hidden rounded-full"
                  style={{ background: "var(--surface-sunken)" }}
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(4, row.share)}%`,
                      background: row.you ? "var(--accent)" : "var(--text-faint)",
                    }}
                  />
                </span>
                <span className="data w-8 text-right text-[11px]">
                  {row.share}%
                </span>
              </span>
            </li>
          ))}
          <li className="text-xs" style={{ color: "var(--text-faint)" }}>
            … and {hiddenSellers} more sellers on the same page
          </li>
        </ul>
        <p
          className="mt-3 border-t pt-2 text-xs"
          style={{ borderColor: "var(--hairline)", color: "var(--text-muted)" }}
        >
          The page never shows you this. Sales rank history does: this one sells
          roughly {demandPerMonth} units a month.
        </p>
      </div>
    </Illustration>
  )
}

/**
 * Where every dollar of the sale price goes. Widths are the real proportions,
 * so the thin slice at the end is the honest shape of the business.
 */
export function UnitSplitIllustration({
  currency,
  salePrice,
  segments,
}: {
  currency: string
  salePrice: number
  segments: { label: string; value: number; tone: "fees" | "cost" | "profit" }[]
}) {
  const tones = {
    fees: "var(--surface-sunken)",
    cost: "var(--text-faint)",
    profit: "var(--buy)",
  }
  return (
    <Illustration
      caption={`Every ${currency} ${salePrice.toFixed(2)} a shopper pays, split to scale.`}
    >
      <div className="p-3">
        <div className="flex h-7 overflow-hidden rounded-md" aria-hidden>
          {segments.map((segment) => (
            <span
              key={segment.label}
              style={{
                width: `${(segment.value / salePrice) * 100}%`,
                background: tones[segment.tone],
              }}
            />
          ))}
        </div>
        <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-3">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: tones[segment.tone] }}
                aria-hidden
              />
              <span style={{ color: "var(--text-muted)" }}>{segment.label}</span>
              <span className="data ml-auto">
                {currency} {segment.value.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Illustration>
  )
}

/** Fifteen products, because the point of the panel is repetition. */
export function PortfolioIllustration({
  currency,
  products,
  perProduct,
}: {
  currency: string
  products: number
  perProduct: number
}) {
  return (
    <Illustration
      caption={`Illustration of ${products} products, each earning about ${currency} ${Math.round(perProduct)} a month.`}
    >
      <div className="p-3">
        <ul className="grid max-w-[19rem] grid-cols-5 gap-2">
          {Array.from({ length: products }, (_, index) => (
            <li key={index} className="grid gap-1">
              <div
                className="grid aspect-square place-items-center rounded-md"
                style={{ background: "var(--surface-sunken)" }}
                aria-hidden
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="var(--text-faint)"
                  strokeWidth="1.25"
                >
                  <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5Z" />
                  <path d="M3 7.5 12 12l9-4.5M12 12v9" />
                </svg>
              </div>
              <span
                className="data text-center text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {Math.round(perProduct)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Illustration>
  )
}

/**
 * The one card on the teaching path holding real data, so it is framed as a
 * read rather than an illustration and says when it was taken.
 */
export function LiveListingCard({
  title,
  asin,
  readDate,
  children,
}: {
  title: string
  asin: string
  readDate: string
  children?: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}
    >
      <div className="flex items-start gap-4">
        <div className="w-20 shrink-0">
          <Thumb tall />
        </div>
        <div className="grid gap-1">
          <span
            className="justify-self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: "var(--buy-tint)", color: "var(--buy-ink)" }}
          >
            live read
          </span>
          <p className="text-sm font-medium">{title}</p>
          <p className="data text-[11px]" style={{ color: "var(--text-muted)" }}>
            {asin} · read {readDate}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

/** The demand split, one block per seller, yours in accent. */
export function ShareBlocksIllustration({
  sellers,
  unitsEach,
}: {
  sellers: number
  unitsEach: string
}) {
  return (
    <Illustration caption="Illustration of an even split — reality is rarely even.">
      <div className="p-3">
        <ul className="grid grid-cols-10 gap-1.5" aria-hidden>
          {Array.from({ length: sellers }, (_, index) => (
            <li
              key={index}
              className="aspect-square rounded"
              style={{
                background:
                  index === 0 ? "var(--accent)" : "var(--surface-sunken)",
              }}
            />
          ))}
        </ul>
        <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: "var(--accent)" }}>The first block is you.</span>{" "}
          Split evenly, each block is about {unitsEach} units a month.
        </p>
      </div>
    </Illustration>
  )
}
