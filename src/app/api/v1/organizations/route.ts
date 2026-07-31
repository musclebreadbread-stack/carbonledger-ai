import { NextRequest } from "next/server";
import { z } from "zod";

const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.enum([
    "manufacturing", "energy", "transportation", "construction",
    "agriculture", "services", "technology", "finance", "healthcare", "retail", "other"
  ]),
  country: z.string().min(1).max(100),
  registration_number: z.string().optional(),
  fiscal_year_start: z.number().min(1).max(12).optional().default(1),
});

export async function GET() {
  // In production, query companies table filtered by user's access
  const organizations = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Sample Manufacturing Co.",
      industry: "manufacturing",
      country: "South Korea",
      registration_number: "123-45-67890",
      fiscal_year_start: 1,
      sites_count: 2,
      created_at: "2024-01-01T00:00:00Z",
    },
  ];

  return Response.json({
    items: organizations,
    total: organizations.length,
    is_sample_data: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    CreateOrganizationSchema.parse(body);

    // Organization creation must atomically create a tenant, assign its first
    // administrator and append an audit event. Never report success until that
    // transaction exists.
    return Response.json(
      {
        error: "Organization persistence is not implemented",
        code: "not_implemented",
      },
      { status: 501 }
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
