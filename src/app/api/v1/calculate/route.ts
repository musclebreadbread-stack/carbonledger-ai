import { NextRequest } from "next/server";
import { z } from "zod";
import { calculate } from "@/lib/calculation-engine";
import type { CalculationInput } from "@/lib/calculation-engine";

const CalculateSchema = z.object({
  activity_data: z.number().positive(),
  unit: z.string(),
  emission_source_type: z.string(),
  scope: z.enum(["scope1", "scope2", "scope3"]),
  fuel_type: z.string().optional(),
  refrigerant_type: z.string().optional(),
  grid_region: z.string().optional(),
  supplier_ef: z.number().optional(),
  custom_ef: z.number().optional(),
  year: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CalculateSchema.parse(body);

    const input: CalculationInput = {
      activity_data: validated.activity_data,
      unit: validated.unit,
      emission_source_type: validated.emission_source_type as CalculationInput["emission_source_type"],
      scope: validated.scope,
      fuel_type: validated.fuel_type as CalculationInput["fuel_type"],
      refrigerant_type: validated.refrigerant_type as CalculationInput["refrigerant_type"],
      grid_region: validated.grid_region,
      supplier_ef: validated.supplier_ef,
      custom_ef: validated.custom_ef,
      year: validated.year,
    };

    const result = calculate(input);

    return Response.json({
      success: true,
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
