import { describe, expect, it } from "vitest";
import { resolveAuthDeploymentMode } from "@/lib/auth/deployment-mode";

describe("authentication deployment mode", () => {
  it("uses Supabase only when both public variables exist", () => {
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    })).toBe("supabase");
  });

  it("enables the local demo by default", () => {
    expect(resolveAuthDeploymentMode({ NODE_ENV: "development" })).toBe("demo");
    expect(resolveAuthDeploymentMode({ NODE_ENV: "test" })).toBe("demo");
  });

  it("allows developers to explicitly disable the local demo", () => {
    expect(resolveAuthDeploymentMode({ NODE_ENV: "development", ENABLE_DEMO_MODE: "false" })).toBe("disabled");
  });

  it("fails closed in production when Supabase is absent", () => {
    expect(resolveAuthDeploymentMode({ NODE_ENV: "production" })).toBe("disabled");
  });

  it("requires an exact opt-in and a strong cookie key for a production demo", () => {
    const secret = "a-random-demo-session-secret-32-bytes";
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "production",
      ENABLE_DEMO_MODE: "true",
      DEMO_SESSION_SECRET: secret,
    })).toBe("demo");
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "production",
      ENABLE_DEMO_MODE: "TRUE",
      DEMO_SESSION_SECRET: secret,
    })).toBe("disabled");
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "production",
      ENABLE_DEMO_MODE: "true",
    })).toBe("disabled");
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "production",
      ENABLE_DEMO_MODE: "true",
      DEMO_SESSION_SECRET: "too-short",
    })).toBe("disabled");
  });

  it("never masks a partial Supabase configuration with demo mode", () => {
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "development",
      ENABLE_DEMO_MODE: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.example",
    })).toBe("disabled");
    expect(resolveAuthDeploymentMode({
      NODE_ENV: "development",
      ENABLE_DEMO_MODE: "true",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    })).toBe("disabled");
  });
});
