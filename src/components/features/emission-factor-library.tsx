"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EmissionFactorRow {
  id: string;
  name: string;
  provider: string;
  version: string;
  value: string;
  unit: string;
  category: string;
}

interface Labels {
  search: string;
  allProviders: string;
  name: string;
  provider: string;
  version: string;
  value: string;
  unit: string;
  category: string;
  noResults: string;
}

export function EmissionFactorLibrary({ factors, labels }: { factors: EmissionFactorRow[]; labels: Labels }) {
  const [query, setQuery] = React.useState("");
  const [provider, setProvider] = React.useState<string | null>(null);
  const providers = React.useMemo(() => [...new Set(factors.map((factor) => factor.provider))], [factors]);
  const visible = React.useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return factors.filter((factor) => {
      if (provider !== null && factor.provider !== provider) return false;
      if (needle === "") return true;
      return [factor.name, factor.provider, factor.version, factor.category]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [factors, provider, query]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="max-w-sm"
          data-testid="factor-search"
        />
        <div className="flex flex-wrap gap-2" aria-label={labels.provider}>
          <Button type="button" size="sm" variant={provider === null ? "secondary" : "outline"} aria-pressed={provider === null} onClick={() => setProvider(null)}>{labels.allProviders}</Button>
          {providers.map((item) => (
            <Button key={item} type="button" size="sm" variant={provider === item ? "secondary" : "outline"} aria-pressed={provider === item} onClick={() => setProvider(item)}>{item}</Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium">{labels.name}</th>
              <th className="px-4 py-3 text-left font-medium">{labels.provider}</th>
              <th className="px-4 py-3 text-left font-medium">{labels.version}</th>
              <th className="px-4 py-3 text-right font-medium">{labels.value}</th>
              <th className="px-4 py-3 text-left font-medium">{labels.unit}</th>
              <th className="px-4 py-3 text-left font-medium">{labels.category}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((factor) => (
              <tr key={factor.id} className="border-b hover:bg-muted/50" data-testid="factor-row">
                <td className="px-4 py-3 font-medium">{factor.name}</td>
                <td className="px-4 py-3"><Badge variant="outline">{factor.provider}</Badge></td>
                <td className="px-4 py-3">{factor.version}</td>
                <td className="px-4 py-3 text-right font-mono">{factor.value}</td>
                <td className="px-4 py-3 text-muted-foreground">{factor.unit}</td>
                <td className="px-4 py-3">{factor.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground" data-testid="factor-empty">{labels.noResults}</p>}
      </div>
    </>
  );
}
