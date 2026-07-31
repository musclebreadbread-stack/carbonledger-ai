/**
 * The suppliers provider, and the only thing a mutation writes to.
 *
 * Same shape and the same caveats as `src/lib/approvals/store.ts`, and they are
 * worth repeating rather than cross-referencing because they determine whether
 * anything on `/suppliers` is a real write:
 *
 *   * state is a module-level array in the serving Node process, so a
 *     verification is visible to later requests *in that process*;
 *   * it is not durable — restart, rebuild or hot reload re-seeds the fixtures;
 *   * it is not shared — a second instance, or a serverless invocation with a
 *     fresh module, has its own copy.
 *
 * Suppliers differ from approvals in one way that matters: a re-request
 * *inserts* a row rather than updating one, so this module has to append as well
 * as replace. It never deletes, mirroring the deliberate absence of a DELETE
 * policy on `supplier_data_requests` in
 * `supabase/migrations/0003_rls_policies_phase2.sql`.
 */

import { buildSampleSuppliersOverview } from "./sample-data";
import type { SupplierActionResult } from "./transitions";
import type { SupplierDataRequest, SuppliersOverview, SuppliersProvider } from "./types";

const SAMPLE_YEAR = 2024;

let state: SuppliersOverview | null = null;

/** Serialises access; see the note in `src/lib/approvals/store.ts`. */
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function seeded(): SuppliersOverview {
  if (state === null) {
    state = buildSampleSuppliersOverview(SAMPLE_YEAR);
  }
  return state;
}

/**
 * Active suppliers provider.
 *
 * `year` is accepted for interface compatibility but the sample fixtures only
 * cover 2024; asking for another year returns the same rows relabelled, which is
 * what the previous provider did too.
 */
export const getSuppliersOverview: SuppliersProvider = async ({ year } = {}) => {
  return serialise(async () => {
    const current = seeded();
    return {
      year: year ?? current.year,
      isSampleData: true,
      suppliers: current.suppliers.map((supplier) => ({ ...supplier })),
      requests: current.requests.map((request) => ({ ...request })),
    };
  });
};

/**
 * Applies `mutate` to one request under the store lock.
 *
 * The mutator sees a copy of the target and of its siblings — it needs the latter
 * to refuse a second re-request of the same rejected attempt — and returns either
 * a replacement row, or a replacement plus a row to insert. Nothing is committed
 * unless it reports success.
 */
export async function mutateSupplierRequest(
  requestId: string,
  mutate: (
    request: SupplierDataRequest,
    siblings: readonly SupplierDataRequest[]
  ) => SupplierActionResult
): Promise<SupplierActionResult> {
  return serialise(async () => {
    const current = seeded();
    const index = current.requests.findIndex((request) => request.id === requestId);
    if (index === -1) return { ok: false, reason: "not_found" };

    const result = mutate(
      { ...current.requests[index] },
      current.requests.map((request) => ({ ...request }))
    );
    if (!result.ok) return result;

    current.requests[index] = result.request;
    if (result.created !== null) {
      // Appended next to the row it replaces rather than at the end, so the
      // attempt and its replacement read as a pair in the requests table.
      current.requests.splice(index + 1, 0, result.created);
    }
    return result;
  });
}

/** Drops the in-memory state so the next read re-seeds. For tests. */
export function resetSuppliersStore(): void {
  state = null;
}
