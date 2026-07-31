import { NextRequest } from "next/server";
import { KOREA_MOE_FUEL_FACTORS, KOREA_MOE_GRID_FACTOR } from "@/constants/emission-factors/korea-moe";
import { IPCC_2006_FACTORS } from "@/constants/emission-factors/ipcc-2006";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const provider = searchParams.get("provider");
  const search = searchParams.get("search");

  let factors: Record<string, unknown>[] = [];

  if (!provider || provider === "korea_moe") {
    factors.push(
      ...Object.entries(KOREA_MOE_FUEL_FACTORS).map(([key, f]) => ({
        id: `korea_moe_${key}`,
        provider: "Korea MOE",
        version: "2023",
        fuel_type: key,
        co2_factor: f.co2_factor,
        unit: f.unit,
        description: f.description_en,
      }))
    );
    factors.push({
      id: "korea_moe_grid",
      provider: "Korea MOE",
      version: "2023",
      fuel_type: "grid_electricity",
      co2_factor: KOREA_MOE_GRID_FACTOR.co2_factor,
      unit: "kgCO2/kWh",
      description: "Korea Grid Electricity",
    });
  }

  if (!provider || provider === "ipcc_2006") {
    factors.push(
      ...Object.entries(IPCC_2006_FACTORS).map(([key, f]) => ({
        id: `ipcc_2006_${key}`,
        provider: "IPCC 2006",
        version: "2006",
        fuel_type: key,
        co2_factor: f.co2_factor,
        unit: f.unit,
        description: f.description,
      }))
    );
  }

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    factors = factors.filter(
      (f) =>
        String(f.fuel_type).toLowerCase().includes(searchLower) ||
        String(f.description).toLowerCase().includes(searchLower)
    );
  }

  return Response.json({
    items: factors,
    total: factors.length,
    is_sample_data: true,
  });
}
