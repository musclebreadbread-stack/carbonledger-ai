"use client";

/**
 * Client-only boundary around the Leaflet map.
 *
 * Leaflet reaches for `window` as soon as it is imported, so the actual map must
 * never be part of a server render. Per the Next.js 16 lazy-loading guide,
 * `next/dynamic` with `ssr: false` is the supported way to opt a component out
 * of prerendering — and it is only allowed inside a Client Component, which is
 * what this file exists to provide. Server Components (including
 * `src/app/(dashboard)/sites/page.tsx`) import *this*, never `site-map-view`.
 */

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { SiteLocation } from "@/lib/sites/types";

interface SiteMapProps {
  sites: SiteLocation[];
  /** Map height in pixels. Kept identical between loader and map to avoid CLS. */
  height?: number;
}

const DEFAULT_HEIGHT = 480;

const SiteMapView = dynamic(() => import("./site-map-view"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

function MapLoadingPlaceholder() {
  const t = useTranslations("sites");

  return (
    <div
      style={{ height: DEFAULT_HEIGHT }}
      className="flex w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
    >
      {t("map_loading")}
    </div>
  );
}

export function SiteMap({ sites, height = DEFAULT_HEIGHT }: SiteMapProps) {
  return <SiteMapView sites={sites} height={height} />;
}
