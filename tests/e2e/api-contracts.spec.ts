import { expect, test } from "@playwright/test";

const validEmission = {
  scope: "scope1",
  emission_source_type: "stationary_combustion",
  activity_data: 1_000,
  unit: "Nm3",
  fuel_type: "natural_gas",
  period_start: "2024-01-01",
  period_end: "2024-01-31",
};

const validOrganization = {
  name: "Sample Organization",
  industry: "manufacturing",
  country: "KR",
};

test.describe("honest preview API contracts", () => {
  test("emissions POST validates input but never claims an unsaved record was created", async ({
    request,
  }) => {
    const invalid = await request.post("/api/v1/emissions", { data: {} });
    expect(invalid.status()).toBe(400);

    const response = await request.post("/api/v1/emissions", { data: validEmission });
    expect(response.status()).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: "Emission persistence is not implemented",
      code: "not_implemented",
    });
  });

  test("organizations POST never claims a tenant transaction happened", async ({ request }) => {
    const response = await request.post("/api/v1/organizations", {
      data: validOrganization,
    });

    expect(response.status()).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: "Organization persistence is not implemented",
      code: "not_implemented",
    });
  });

  test("reference and sample GET responses identify themselves", async ({ request }) => {
    const factors = await (await request.get("/api/v1/emission-factors")).json();
    const organizations = await (await request.get("/api/v1/organizations")).json();
    const audit = await (await request.get("/api/v1/audit-log")).json();
    const emissions = await (await request.get("/api/v1/emissions")).json();

    expect(factors.is_sample_data).toBe(true);
    expect(organizations.is_sample_data).toBe(true);
    expect(audit.is_sample_data).toBe(true);
    expect(emissions.data_source).toBe("not_connected");
  });

  test("sample resource identifiers are stable across requests", async ({ request }) => {
    const first = await (await request.get("/api/v1/organizations")).json();
    const second = await (await request.get("/api/v1/organizations")).json();

    expect(first.items[0].id).toBe("11111111-1111-1111-1111-111111111111");
    expect(second.items[0].id).toBe(first.items[0].id);
  });
});
