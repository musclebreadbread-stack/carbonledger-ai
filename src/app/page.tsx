import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-carbon-50 to-ocean-50 dark:from-carbon-950 dark:to-ocean-950">
      <main className="mx-auto max-w-4xl px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-foreground">
          CarbonLedger AI
        </h1>
        <p className="mb-8 text-xl text-muted-foreground">
          AI-powered Enterprise GHG (Scope 1, 2, 3) Integrated Management Platform
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Create Account
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-semibold">ISO 14064 Compliant</h3>
            <p className="text-sm text-muted-foreground">
              Full compliance with international GHG accounting standards including ISO 14064, GHG
              Protocol, and IPCC guidelines.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-semibold">AI-Powered Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Intelligent emission factor matching, anomaly detection, and reduction pathway
              recommendations powered by AI.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-2 font-semibold">MRV Pipeline</h3>
            <p className="text-sm text-muted-foreground">
              Complete Measurement, Reporting, and Verification pipeline with full data lineage and
              audit trail.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
