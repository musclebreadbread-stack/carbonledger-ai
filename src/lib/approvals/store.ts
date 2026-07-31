/**
 * The approvals provider, and the only thing a mutation writes to.
 *
 * How mutations actually behave here — stated plainly, because the honest answer
 * is not "it works like a database":
 *
 *   * State lives in a module-level array in the Node process serving the app.
 *     A decision recorded by a Server Action is visible to every subsequent
 *     render *in that process*, so the chain really does advance between
 *     requests and the E2E suite observes it.
 *   * It is **not durable**. Restarting the server, rebuilding, or a hot reload
 *     in development resets the array to the seeded fixtures.
 *   * It is **not shared**. Two server instances, or a serverless deployment
 *     where each invocation is a fresh module, each keep their own copy, so a
 *     user could see a decision appear and then vanish depending on which
 *     instance answered.
 *
 * That is a working write path for a single-process deployment and a demo, and
 * nothing more. Replacing this module with a Drizzle-backed provider is the whole
 * of what "going live" means: `getApprovalsOverview` becomes a SELECT, and
 * `mutateApprovalInstance` becomes an UPDATE plus an INSERT inside one
 * transaction, at which point the RLS policies in
 * `supabase/migrations/0003_rls_policies_phase2.sql` enforce the same rules a
 * second time, from the database side.
 */

import { buildSampleApprovalsOverview } from "./sample-data";
import type { ApprovalActionResult } from "./transitions";
import type { ApprovalInstance, ApprovalsProvider } from "./types";

/** Null until first read. Seeded lazily so importing this module is cheap. */
let instances: ApprovalInstance[] | null = null;

/**
 * Serialises store access.
 *
 * Server Actions are dispatched one at a time *per client*, not globally, so two
 * users acting on the same instance can interleave. Without this, both would read
 * the same pre-state and the second write would silently discard the first
 * decision — losing an approval step is not an acceptable race. A promise chain
 * is enough because everything here is in-process and short.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialise<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  // Swallow rejections on the chain itself so one failed mutation does not
  // poison every later one.
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/** Defensive copy, so a caller cannot reach into the store through its result. */
function clone(instance: ApprovalInstance): ApprovalInstance {
  return { ...instance, steps: instance.steps.map((step) => ({ ...step })) };
}

async function seeded(): Promise<ApprovalInstance[]> {
  if (instances === null) {
    instances = (await buildSampleApprovalsOverview()).instances;
  }
  return instances;
}

/**
 * Active approvals provider.
 *
 * `isSampleData` stays true after a mutation: the instances are still the sample
 * fixtures, now with sample decisions recorded against them, and the page's
 * notice should keep saying so.
 */
export const getApprovalsOverview: ApprovalsProvider = async () => {
  const current = await serialise(async () => (await seeded()).map(clone));
  return { isSampleData: true, instances: current };
};

/** One instance by id, or null. Copy, like the provider. */
export async function getApprovalInstance(instanceId: string): Promise<ApprovalInstance | null> {
  return serialise(async () => {
    const found = (await seeded()).find((instance) => instance.id === instanceId);
    return found ? clone(found) : null;
  });
}

/**
 * Applies `mutate` to one instance under the store lock, committing only when it
 * reports success.
 *
 * The mutator receives a copy and returns a whole replacement instance rather
 * than editing in place, so a refusal leaves the store untouched — a rejected
 * action must not half-apply.
 */
export async function mutateApprovalInstance(
  instanceId: string,
  mutate: (instance: ApprovalInstance) => Promise<ApprovalActionResult>
): Promise<ApprovalActionResult> {
  return serialise(async () => {
    const store = await seeded();
    const index = store.findIndex((instance) => instance.id === instanceId);
    if (index === -1) return { ok: false, reason: "not_found" };

    const result = await mutate(clone(store[index]));
    if (result.ok) {
      store[index] = result.instance;
    }
    return result;
  });
}

/**
 * Drops the in-memory state so the next read re-seeds.
 *
 * Exists for tests, which would otherwise leak state between cases through this
 * module's closure.
 */
export function resetApprovalsStore(): void {
  instances = null;
}
