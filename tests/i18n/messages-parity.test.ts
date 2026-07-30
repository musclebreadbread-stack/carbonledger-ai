/**
 * Guards the invariant that every locale catalogue carries exactly the same
 * keys. Korean is the source of truth for wording, so it is also the reference
 * for the key set: a string added to `ko.json` and forgotten elsewhere shows up
 * here as a missing key rather than as a runtime `MISSING_MESSAGE` error in
 * whichever language the reviewer does not happen to be testing in.
 */

import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import ko from "@/messages/ko.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import zh from "@/messages/zh.json";

type Messages = Record<string, unknown>;

const CATALOGUES: Record<string, Messages> = { ko, en, ja, zh };

/** Flattens a nested message object into dot-separated leaf paths. */
function leafKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? leafKeys(value as Messages, path)
      : [path];
  });
}

/** Extracts ICU placeholder names, e.g. "{count} sites" -> ["count"]. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)/g)].map((match) => match[1]).sort();
}

function valueAt(messages: Messages, path: string): unknown {
  return path.split(".").reduce<unknown>((node, segment) => {
    return node && typeof node === "object"
      ? (node as Record<string, unknown>)[segment]
      : undefined;
  }, messages);
}

const referenceKeys = leafKeys(ko).sort();

describe("message catalogues", () => {
  it("covers every configured locale", () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual([...locales].sort());
  });

  it.each(Object.keys(CATALOGUES))("%s has the same keys as ko", (locale) => {
    const keys = leafKeys(CATALOGUES[locale]).sort();

    // Reported as two explicit diffs so a failure names the offending keys
    // instead of dumping both full catalogues.
    expect(referenceKeys.filter((key) => !keys.includes(key))).toEqual([]);
    expect(keys.filter((key) => !referenceKeys.includes(key))).toEqual([]);
  });

  it.each(Object.keys(CATALOGUES))("%s has no empty messages", (locale) => {
    const empty = leafKeys(CATALOGUES[locale]).filter((key) => {
      const value = valueAt(CATALOGUES[locale], key);
      return typeof value !== "string" || value.trim() === "";
    });

    expect(empty).toEqual([]);
  });

  it.each(Object.keys(CATALOGUES))("%s uses the same ICU arguments as ko", (locale) => {
    const mismatches = referenceKeys
      .map((key) => ({
        key,
        expected: placeholders(String(valueAt(ko, key))),
        actual: placeholders(String(valueAt(CATALOGUES[locale], key))),
      }))
      .filter(({ expected, actual }) => expected.join(",") !== actual.join(","));

    expect(mismatches).toEqual([]);
  });
});
