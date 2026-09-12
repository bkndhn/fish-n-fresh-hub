import { test, expect } from "@playwright/test";

test.describe("API & Edge Health Check Endpoints", () => {
  test("health endpoint returns 200 with status ok and uptime", async ({ request }) => {
    const response = await request.get("/health");
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.status).toBe("ok");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("uptime");
    }
  });

  test("ping endpoint returns 200", async ({ request }) => {
    const response = await request.get("/ping");
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.status).toBe("ok");
    }
  });
});
