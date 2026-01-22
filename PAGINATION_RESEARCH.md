In a React + Supabase stack, the clean “infinite scroll triggers fetchMore” options basically fall into 3 buckets:

1) React Query (TanStack) useInfiniteQuery + IntersectionObserver (most common)

How it works
	•	useInfiniteQuery holds pages + handles “fetch next page”.
	•	An IntersectionObserver watches a sentinel div at the bottom; when visible → fetchNextPage().

Pagination style
	•	Offset pagination: range(from, to) (simple, ok for mostly-static lists).
	•	Keyset pagination: lt/gt on a stable ordered column (best for changing data).

Keyset example shape (recommended)
	•	Order by created_at desc, id desc (stable tie-breaker).
	•	Next page uses the last item’s (created_at, id) cursor.

When to pick: almost always, unless you’re on Relay/Apollo already.

⸻

2) SWR Infinite useSWRInfinite + IntersectionObserver

Very similar ergonomics:
	•	getKey(pageIndex, previousPageData) returns the next “cursor”.
	•	Works great if you already use SWR.
	•	Same offset vs keyset choice applies.

When to pick: if your app is SWR-first.

⸻

3) Virtualized list (performance) + one of the above

If you have long feeds (hundreds/thousands of rows), combine:
	•	react-virtual or react-window
with
	•	React Query/SWR infinite loading

This keeps DOM small while still doing infinite paging.

When to pick: large lists / mobile performance matters.

⸻

The important part: Supabase pagination patterns

A) Offset pagination (easy)

// pageParam = pageIndex
const PAGE_SIZE = 20
const from = pageParam * PAGE_SIZE
const to = from + PAGE_SIZE - 1

supabase
  .from("products")
  .select("*")
  .order("created_at", { ascending: false })
  .range(from, to)

Pros: simplest
Cons: can “shift” if new rows inserted; can be slow deep in pages

B) Keyset / cursor pagination (best practice)

Use a stable order + cursor.

Page 1

supabase
  .from("products")
  .select("*")
  .order("created_at", { ascending: false })
  .order("id", { ascending: false })
  .limit(PAGE_SIZE)

Next page (cursor from last row)
If your cursor is { created_at, id }, query rows “older than” that cursor.

Supabase doesn’t have a direct (created_at, id) < (...) tuple operator, so you do it as:
	•	created_at < last_created_at OR
	•	created_at = last_created_at AND id < last_id

In PostgREST syntax you can express this with or(...):

supabase
  .from("products")
  .select("*")
  .or(
    `created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`
  )
  .order("created_at", { ascending: false })
  .order("id", { ascending: false })
  .limit(PAGE_SIZE)

Pros: stable under inserts/deletes, faster deep paging
Cons: slightly more complex

⸻

A concrete “infinite scroll” setup (React Query)

Hook

import { useInfiniteQuery } from "@tanstack/react-query"

const PAGE_SIZE = 20

async function fetchProducts({ pageParam }: { pageParam?: { created_at: string; id: string } }) {
  let query = supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE)

  if (pageParam) {
    query = query.or(
      `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ["products"],
    queryFn: ({ pageParam }) => fetchProducts({ pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      const last = lastPage?.[lastPage.length - 1]
      return last ? { created_at: last.created_at, id: last.id } : undefined
    },
  })
}

IntersectionObserver

import { useEffect, useRef } from "react"

export function useInfiniteScroll({ hasNextPage, fetchNextPage, isFetchingNextPage }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current

    const io = new IntersectionObserver((entries) => {
      const first = entries[0]
      if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    })

    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, fetchNextPage, isFetchingNextPage])

  return ref
}

Usage

const q = useInfiniteProducts()
const items = q.data?.pages.flat() ?? []
const sentinelRef = useInfiniteScroll({
  hasNextPage: q.hasNextPage,
  fetchNextPage: q.fetchNextPage,
  isFetchingNextPage: q.isFetchingNextPage,
})

return (
  <>
    {items.map(p => <ProductCard key={p.id} product={p} />)}
    <div ref={sentinelRef} style={{ height: 1 }} />
  </>
)


⸻

Extras you’ll want in production
	•	Debounce/throttle sentinel triggers (or guard with isFetchingNextPage like above).
	•	Prefetch threshold: use rootMargin: "600px" so it fetches before the user hits bottom.
	•	Stable ordering: always add a tie-breaker (id).
	•	Realtime changes: if you use Supabase realtime, consider invalidating the first page only, not the whole infinite list.
	•	Caching policy: set React Query staleTime to reduce refetch spam while scrolling.

⸻

If you tell me:
	1.	what table you’re paging (products? orders? posts?), and
	2.	what your sort is (newest, price, relevance),
I’ll tailor the exact keyset cursor query so it’s stable and index-friendly.