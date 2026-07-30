/**
 * Visible banner marking figures on the page as sample/mock data.
 *
 * Rendered whenever a data provider returns `isSampleData: true`. Keeping the
 * notice driven by that flag (rather than hard-coding it) means it disappears on
 * its own the moment a real database-backed provider is wired in.
 *
 * Takes the already-translated message as a prop so it stays a plain
 * presentational component usable from both Server and Client Components.
 */

interface SampleDataNoticeProps {
  message: string;
}

export function SampleDataNotice({ message }: SampleDataNoticeProps) {
  return (
    <div
      data-testid="sample-data-notice"
      role="note"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
