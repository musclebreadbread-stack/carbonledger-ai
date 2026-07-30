/**
 * End-to-end guards for the report generator.
 *
 * `routing.spec.ts` proves `/reports` resolves. This file proves the page offers
 * every promised report and that clicking a download actually yields a file of
 * the right kind — the assertion that would fail if the API route threw, streamed
 * an empty body, or served JSON with a `.pdf` filename.
 *
 * Downloads are fetched through Playwright's `request` context rather than by
 * driving a browser download: the bytes are what matter, and `request` lets the
 * test check magic numbers and headers directly instead of poking at a temporary
 * file the browser chose the location of.
 */

import { expect, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

/** Must match `REPORT_TYPES` in `src/lib/reports/registry.ts`. */
const REPORT_TYPES = [
  "iso14064",
  "cdp",
  "sbti",
  "gri",
  "esg",
  "sustainability",
  "issb",
  "tcfd",
  "csrd",
] as const;

const FORMATS = ["pdf", "xlsx", "csv"] as const;

test.describe("reports page", () => {
  test("renders the heading, the sample-data notice and the PDF language caveat", async ({
    page,
  }) => {
    await page.goto("/reports");

    await expect(page.locator("h1")).toHaveText(ko.reports.title);
    await expect(page.getByTestId("sample-data-notice")).toContainText(
      ko.reports.sample_data_notice
    );
    // The PDF encoding limitation has to be stated in the UI, not just in a
    // comment: Korean is the default locale and PDF output cannot represent it.
    await expect(page.getByTestId("report-language-notice")).toContainText(
      ko.reports.language_notice_body
    );
  });

  test("offers a card for every report type the product promises", async ({ page }) => {
    await page.goto("/reports");

    const cards = page.getByTestId("report-type-card");
    await expect(cards).toHaveCount(REPORT_TYPES.length);

    for (const type of REPORT_TYPES) {
      await expect(
        page.locator(`[data-testid="report-type-card"][data-report-type="${type}"]`)
      ).toHaveCount(1);
    }
  });

  test("labels partially implemented frameworks as partial, not as done", async ({ page }) => {
    await page.goto("/reports");

    for (const type of ["issb", "tcfd", "csrd"] as const) {
      const card = page.locator(`[data-testid="report-type-card"][data-report-type="${type}"]`);
      await expect(card).toContainText(ko.reports.coverage_partial);
    }
    for (const type of ["iso14064", "gri", "sbti"] as const) {
      const card = page.locator(`[data-testid="report-type-card"][data-report-type="${type}"]`);
      await expect(card).toContainText(ko.reports.coverage_full);
    }
  });

  test("links all three formats for every report type", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByTestId("report-download-link")).toHaveCount(
      REPORT_TYPES.length * FORMATS.length
    );

    for (const type of REPORT_TYPES) {
      for (const format of FORMATS) {
        const link = page.locator(
          `[data-testid="report-download-link"][data-report-type="${type}"][data-report-format="${format}"]`
        );
        await expect(link).toHaveAttribute("href", `/api/v1/reports?type=${type}&format=${format}`);
        // `download` is what makes a hyperlink save rather than navigate.
        await expect(link).toHaveAttribute("download", "");
      }
    }
  });

  test("renders no unsubstituted placeholder or raw message key", async ({ page }) => {
    await page.goto("/reports");
    const rendered = await page.locator("main").innerText();

    expect(rendered).not.toMatch(/\{[a-zA-Z]\w*\}/);
    expect(rendered).not.toContain("MISSING_MESSAGE");
    expect(rendered).not.toMatch(/\breports\.[a-z_]+\b/);
  });
});

test.describe("report catalogue API", () => {
  test("lists every report type with its coverage", async ({ request }) => {
    const response = await request.get("/api/v1/reports");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.total).toBe(REPORT_TYPES.length);
    expect(body.types.map((type: { id: string }) => type.id).sort()).toEqual(
      [...REPORT_TYPES].sort()
    );
    expect(body.is_sample_data).toBe(true);
    expect(body.formats).toEqual(["pdf", "xlsx", "csv", "json"]);
  });
});

test.describe("report downloads", () => {
  for (const type of REPORT_TYPES) {
    test(`${type} generates a real PDF, workbook and CSV`, async ({ request }) => {
      for (const format of FORMATS) {
        const response = await request.get(`/api/v1/reports?type=${type}&format=${format}`);
        expect(response.status(), `${type}.${format}`).toBe(200);

        const headers = response.headers();
        expect(headers["content-disposition"]).toContain(
          `filename="carbonledger-${type}-2024-01-01_2024-12-31.${format}"`
        );
        // A generated report must not be served from a shared cache.
        expect(headers["cache-control"]).toContain("no-store");

        const body = await response.body();
        expect(body.byteLength, `${type}.${format} should not be empty`).toBeGreaterThan(1000);

        if (format === "pdf") {
          expect(headers["content-type"]).toContain("application/pdf");
          expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
          // A PDF is only loadable if it ends with the EOF marker.
          expect(body.subarray(-32).toString("latin1")).toContain("%%EOF");
        } else if (format === "xlsx") {
          expect(headers["content-type"]).toContain("spreadsheetml");
          // XLSX is a zip: local file header magic "PK\x03\x04".
          expect([...body.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
        } else {
          expect(headers["content-type"]).toContain("text/csv");
          // UTF-8 BOM, so Excel on Windows reads the file as UTF-8.
          expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
          expect(body.toString("utf8")).toContain("section_id,section_title");
        }
      }
    });
  }

  test("rejects an unknown report type with the list of valid ones", async ({ request }) => {
    const response = await request.get("/api/v1/reports?type=not-a-report");
    expect(response.status()).toBe(400);

    const body = await response.json();
    // Sorted: the error lists the canonical id order, the page renders the
    // catalogue order, and neither is the other's business.
    expect([...body.valid_types].sort()).toEqual([...REPORT_TYPES].sort());
  });

  test("rejects a period that does not exist rather than rolling it forward", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/v1/reports?type=gri&format=json&period_start=2024-02-30"
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("ISO-8601");
  });

  test("generates from a POST body and can return the document as JSON", async ({ request }) => {
    const response = await request.post("/api/v1/reports", {
      data: {
        type: "cdp",
        format: "json",
        period_start: "2023-04-01",
        period_end: "2024-03-31",
        organization_name: "Acme Industrial",
      },
    });
    expect(response.status()).toBe(200);

    const document = await response.json();
    expect(document.type).toBe("cdp");
    expect(document.organizationName).toBe("Acme Industrial");
    expect(document.periodStart).toBe("2023-04-01");
    expect(document.isSampleData).toBe(true);
    expect(document.sections.length).toBeGreaterThan(0);
  });

  test("still accepts the legacy uppercase type spelling", async ({ request }) => {
    const response = await request.get("/api/v1/reports?type=ISO14064&format=csv");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("carbonledger-iso14064-");
  });
});
