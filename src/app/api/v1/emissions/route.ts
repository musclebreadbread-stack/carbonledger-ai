import { NextRequest } from "next/server";
import { z } from "zod";

const EmissionRecordSchema = z.object({
  scope: z.enum(["scope1", "scope2", "scope3"]),
  emission_source_type: z.string(),
  activity_data: z.number().positive(),
  unit: z.string(),
  fuel_type: z.string().optional(),
  refrigerant_type: z.string().optional(),
  site_id: z.string().uuid().optional(),
  period_start: z.string(),
  period_end: z.string(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const scope = searchParams.get("scope");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  // In production, this would query the database with RLS
  const data = {
    items: [],
    total: 0,
    page,
    limit,
    filters: { scope, status },
  };

  return Response.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = EmissionRecordSchema.parse(body);

    // In production:
    // 1. Get user from session
    // 2. Run calculation engine
    // 3. Create record in database
    // 4. Create audit trail entry
    // 5. Return result

    return Response.json(
      {
        id: crypto.randomUUID(),
        ...validated,
        status: "draft",
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
