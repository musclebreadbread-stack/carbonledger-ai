import { LocaleSwitcher } from "@/components/features/locale-switcher";
import { ThemeToggle } from "@/components/features/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      {/* Language and theme are reachable before sign-in on purpose: a visitor who
          cannot read the login form cannot get far enough to change the setting
          from /settings. */}
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <main id="main-content" className="w-full max-w-lg space-y-6 p-6">
        {children}
      </main>
    </div>
  );
}
