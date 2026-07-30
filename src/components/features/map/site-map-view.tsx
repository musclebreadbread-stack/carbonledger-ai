"use client";

/**
 * Leaflet implementation of the site map.
 *
 * IMPORTANT: this module must only ever be evaluated in the browser. Leaflet
 * touches `window`/`document` at import time, so it is loaded exclusively
 * through `next/dynamic` with `ssr: false` from `site-map.tsx`. The Next.js 16
 * lazy-loading guide is explicit that `ssr: false` only works when the
 * `dynamic()` call lives in a Client Component, which is why the wrapper is a
 * separate `"use client"` file rather than the page itself.
 *
 * Because the module never runs on the server, `leaflet` and its stylesheet can
 * be imported statically here — no `await import()` inside an effect needed.
 *
 * react-leaflet is deliberately not used: it is not a dependency of this
 * project, so the map is driven through Leaflet's imperative API.
 */

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocale, useTranslations } from "next-intl";
import { withCoordinates, type SiteLocation } from "@/lib/sites/types";

export interface SiteMapViewProps {
  sites: SiteLocation[];
  /** Map height in pixels. */
  height: number;
}

/** Fallback view (roughly centred on South Korea) when nothing is plottable. */
const FALLBACK_CENTER: L.LatLngTuple = [36.5, 127.8];
const FALLBACK_ZOOM = 7;

/** Marker radius bounds in pixels; area scales with emissions. */
const MIN_RADIUS = 7;
const MAX_RADIUS = 24;

export default function SiteMapView({ sites, height }: SiteMapViewProps) {
  const t = useTranslations("sites");
  const tNames = useTranslations("site_names");
  const tAddresses = useTranslations("site_addresses");
  const locale = useLocale();

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);

  const geolocated = React.useMemo(() => withCoordinates(sites), [sites]);

  /*
   * Translation lookups are read inside the effect below. They are wrapped in
   * refs-by-way-of-useCallback so the effect does not re-run (and tear the map
   * down) on every render just because the translator identity changed.
   */
  const resolveName = React.useCallback(
    (key: string) => (tNames.has(key) ? tNames(key) : key),
    [tNames]
  );
  const resolveAddress = React.useCallback(
    (key: string | null) => (key && tAddresses.has(key) ? tAddresses(key) : key),
    [tAddresses]
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /*
     * React 18/19 StrictMode runs effects twice in development. Leaflet throws
     * "Map container is already initialized" if a second map is attached to the
     * same node, so the cleanup below always calls `remove()` and this guard
     * covers the case where a stale instance is still attached.
     */
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(container, {
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      // Wheel-zoom hijacks page scrolling inside a dashboard; require a
      // deliberate interaction instead.
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    // OpenStreetMap requires visible attribution. Tiles need outbound network
    // access from the browser; if they fail to load the markers still render.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (geolocated.length > 0) {
      const maxEmissions = Math.max(...geolocated.map((site) => site.annualEmissions), 1);
      const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

      for (const site of geolocated) {
        // Scale by square root so the *area* of the circle tracks emissions;
        // scaling the radius directly exaggerates large sites.
        const ratio = Math.sqrt(site.annualEmissions / maxEmissions);
        const radius = MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);

        const marker = L.circleMarker([site.latitude, site.longitude], {
          radius,
          color: "#0f766e",
          weight: 2,
          fillColor: "#14b8a6",
          fillOpacity: 0.55,
        }).addTo(map);

        // Build the popup as DOM rather than an HTML string so site names and
        // addresses can never be interpreted as markup.
        const popup = document.createElement("div");
        popup.className = "text-xs leading-relaxed";

        const name = document.createElement("strong");
        name.className = "block text-sm";
        name.textContent = resolveName(site.nameKey);
        popup.append(name);

        const address = resolveAddress(site.addressKey);
        if (address) {
          const addressEl = document.createElement("div");
          addressEl.textContent = address;
          popup.append(addressEl);
        }

        const emissions = document.createElement("div");
        emissions.textContent = `${t("annual_emissions")}: ${numberFormat.format(
          site.annualEmissions
        )} ${t("unit_tco2e")}`;
        popup.append(emissions);

        const facilities = document.createElement("div");
        facilities.textContent = `${t("facilities")}: ${site.facilityCount}`;
        popup.append(facilities);

        if (site.gridRegion) {
          const grid = document.createElement("div");
          grid.textContent = `${t("grid_region")}: ${site.gridRegion}`;
          popup.append(grid);
        }

        marker.bindPopup(popup);
        marker.bindTooltip(resolveName(site.nameKey));
      }

      map.fitBounds(
        L.latLngBounds(geolocated.map((site) => [site.latitude, site.longitude] as L.LatLngTuple)),
        { padding: [40, 40], maxZoom: 11 }
      );
    }

    /*
     * The map is created before the flex/grid layout has necessarily settled,
     * which leaves Leaflet with a stale container size and grey gaps between
     * tiles. Re-measure once the browser has laid out, and on every resize.
     */
    const invalidate = () => map.invalidateSize();
    const raf = requestAnimationFrame(invalidate);
    window.addEventListener("resize", invalidate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", invalidate);
      map.remove();
      mapRef.current = null;
    };
  }, [geolocated, locale, resolveName, resolveAddress, t]);

  return (
    <div
      ref={containerRef}
      data-testid="site-map"
      style={{ height }}
      className="w-full overflow-hidden rounded-md border bg-muted"
      role="application"
      aria-label={t("map_title")}
    />
  );
}
