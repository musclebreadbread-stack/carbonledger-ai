import { NextRequest } from "next/server";
import { z } from "zod";

const GenerateReportSchema = z.object({
  type: z.enum(["ISO14064", "CDP", "GRI", "internal"]),
  period_start: z.string(),
  period_end: z.string(),
  scopes: z.array(z.enum(["scope1", "scope2", "scope3"])).optional(),
  format: z.enum(["pdf", "xlsx", "json"]).optional().default("pdf"),
});

export async function GET() {
  // In production, query generated reports from database
  const reports = [
    {
      id: crypto.randomUUID(),
      type: "ISO14064",
      name: "ISO 14064 Annual Report 2023",
      status: "completed",
      generated_at: "2024-03-15T10:00:00Z",
      period_start: "2023-01-01",
      period_end: "2023-12-31",
    },
  ];

  return Response.json({ items: reports, total: reports.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = GenerateReportSchema.parse(body);

    // In production:
    // 1. Aggregate emission records for period
    // 2. Run MRV pipeline
    // 3. Generate report document
    // 4. Store in database
    // 5. Create audit entry

    return Response.json(
      {
        id: crypto.randomUUID(),
        ...validated,
        status: "generating",
        generated_at: new Date().toISOString(),
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
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
