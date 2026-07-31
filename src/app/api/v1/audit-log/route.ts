import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const table = searchParams.get("table");
  const action = searchParams.get("action");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  // In production, query audit_logs table with filters
  // Audit log is read-only - no POST/PUT/DELETE endpoints
  const entries = [
    {
      id: "99999999-9999-9999-9999-999999999901",
      timestamp: "2024-01-15T14:32:00Z",
      table_name: "emission_records",
      record_id: "55555555-5555-5555-5555-555555550101",
      action: "create",
      user_id: "user-1",
      user_email: "sample-admin@example.invalid",
      description: "Created emission record for Boiler #1",
    },
  ];

  return Response.json({
    items: entries,
    total: entries.length,
    page,
    limit,
    filters: { table, action },
    is_sample_data: true,
  });
}
