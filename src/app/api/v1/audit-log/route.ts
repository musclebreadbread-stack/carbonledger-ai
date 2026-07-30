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
      id: crypto.randomUUID(),
      timestamp: "2024-01-15T14:32:00Z",
      table_name: "emission_records",
      record_id: crypto.randomUUID(),
      action: "create",
      user_id: "user-1",
      user_email: "admin@company.com",
      description: "Created emission record for Boiler #1",
    },
  ];

  return Response.json({
    items: entries,
    total: entries.length,
    page,
    limit,
    filters: { table, action },
  });
}
