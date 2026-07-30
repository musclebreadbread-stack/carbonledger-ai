/**
 * Shared fixtures for the report generator tests.
 *
 * `hostileDocument` is the important one. It carries the strings that break naive
 * generators: values with embedded commas, double quotes and newlines (CSV
 * escaping), Korean/Japanese/Chinese text (pdf-lib's WinAnsi fonts throw on it),
 * and a section title full of characters Excel forbids in a worksheet name. Every
 * renderer is driven with it so a regression shows up as a failing assertion
 * rather than as a 500 in a download handler.
 */

import type { ReportDocument } from "@/lib/reports/types";

/** A value containing every CSV metacharacter at once. */
export const HOSTILE_VALUE = 'Line one, with comma\nLine "two" with quotes\r\nand a CRLF';

/** Korean, Japanese and Chinese text — none of it representable in WinAnsi. */
export const KOREAN_TEXT = "온실가스 배출량 보고서";
export const JAPANESE_TEXT = "温室効果ガス排出量";
export const CHINESE_TEXT = "温室气体排放量";

export function hostileDocument(): ReportDocument {
  return {
    type: "iso14064",
    title: `${KOREAN_TEXT} / GHG Inventory`,
    standardReference: "ISO 14064-1:2018",
    coverage: "full",
    organizationName: "삼성전자 주식회사",
    periodStart: "2024-01-01",
    periodEnd: "2024-12-31",
    generatedAt: "2024-12-31T00:00:00.000Z",
    isSampleData: true,
    notes: [HOSTILE_VALUE, `${JAPANESE_TEXT} ${CHINESE_TEXT}`],
    sections: [
      {
        // Every character Excel forbids in a sheet name, plus a length overrun.
        id: "a/b:c*d?e[f]g",
        title: "Section with [brackets] : colons * stars ? and a very long tail indeed",
        blocks: [
          { kind: "paragraph", text: HOSTILE_VALUE },
          {
            kind: "keyValues",
            items: [
              { label: "Label, with comma", value: HOSTILE_VALUE },
              { label: KOREAN_TEXT, value: JAPANESE_TEXT },
              { label: "Arrow", value: "2018 \u2192 2030 \u2265 4.2%" },
            ],
          },
          {
            kind: "table",
            table: {
              columns: ["Key", 'Quoted "column"', "Emissions"],
              numericColumns: [2],
              rows: [
                [HOSTILE_VALUE, KOREAN_TEXT, 1234.5],
                ["plain", null, 0],
                ["negative", CHINESE_TEXT, -42],
              ],
            },
          },
        ],
      },
      {
        // Collides with the first section's sanitised name on purpose.
        id: "a b c d e f g",
        title: "Section with [brackets] : colons * stars ? and a very long tail indeed",
        blocks: [{ kind: "paragraph", text: "Second section, same name after sanitising." }],
      },
    ],
  };
}
