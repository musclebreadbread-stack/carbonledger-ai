"use client";

import * as React from "react";
import { Sidebar } from "@/components/features/sidebar";
import { Header, type HeaderUser } from "@/components/features/header";
import { CommandPalette } from "@/components/features/command-palette";
import type { LocalisedNotification } from "@/lib/notifications";
import type { NavRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  /** Current work items already localised on the server and filtered to visible routes. */
  notifications: LocalisedNotification[];
  /** Nav destinations for the current role, resolved on the server. */
  routes: readonly NavRoute[];
  user: HeaderUser;
}

/**
 * Client shell for the dashboard: sidebar collapse, mobile drawer, palette state.
 *
 * Extracted so that `(dashboard)/layout.tsx` can be a Server Component. The layout
 * used to be `"use client"`, which meant nothing in the chrome could see the
 * session — hence a header that hard-coded one user and a nav that showed every
 * page to every role. The server-resolved data now arrives as props and the
 * interactive state stays here, where it belongs.
 */
export function DashboardShell({
  children,
  notifications,
  routes,
  user,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
          mobileOpen ? "block" : "hidden lg:block"
        )}
      >
        <Sidebar
          routes={routes}
          collapsed={sidebarCollapsed}
          onToggle={() => {
            setSidebarCollapsed(!sidebarCollapsed);
            setMobileOpen(false);
          }}
          // Navigating used to leave the drawer covering the page it had just
          // opened, on exactly the viewport where that is hardest to recover from.
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
          onCommandPaletteOpen={() => setPaletteOpen(true)}
          notifications={notifications}
          user={user}
        />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      <CommandPalette routes={routes} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
