"use client";

import * as React from "react";

/**
 * True once the component has hydrated on the client, false during SSR and the
 * hydration render itself.
 *
 * Needed by anything whose correct output depends on browser-only state — the
 * theme, which `next-themes` reads from localStorage. Rendering the real value
 * before hydration completes produces markup the client immediately disagrees
 * with, and React reports the mismatch.
 *
 * Implemented with `useSyncExternalStore` rather than the more obvious
 * `useState(false)` + `useEffect(() => setMounted(true))`. The effect version
 * schedules a second render pass as a side effect of the first, which is exactly
 * the cascade `react-hooks/set-state-in-effect` exists to prevent; here React
 * itself switches from the server snapshot to the client one as part of hydration,
 * with no extra state and no effect.
 *
 * The subscribe function never fires, deliberately: the value transitions once, at
 * hydration, and there is nothing further to subscribe to.
 */
const NEVER_CHANGES = () => () => {};

export function useHasMounted(): boolean {
  return React.useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false
  );
}
