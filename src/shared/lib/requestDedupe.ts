/**
 * In-flight request deduplication.
 *
 * When several components mount in the same render and each call the same
 * fetcher, they should share one network request. This helper returns the
 * same Promise for concurrent callers keyed on an arbitrary string. Once the
 * promise settles, the entry is removed so subsequent calls re-fetch (we
 * don't keep stale data; this is dedup, not caching).
 *
 * Pattern matches the existing `publicPracticeDetailsInFlight` map in
 * `apiClient.ts` but generalises it so the same primitive can be reused for
 * the other endpoints that the perf audit flagged as repeatedly fetched
 * (invoices list, practice details, onboarding status, list-accounts).
 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupeInflight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = factory().finally(() => {
    // Only delete if still pointing at this promise — a later caller may have
    // already replaced it after a mutation invalidated the entry.
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/**
 * Drop one or all in-flight entries. Call after a mutation that should
 * invalidate the next read. With no argument, clears the whole map (e.g. on
 * sign-out so the next session can't reuse a half-resolved promise).
 */
export function clearInflight(key?: string): void {
  if (key) inflight.delete(key);
  else inflight.clear();
}
