import { test, expect } from "@playwright/test";

test.describe("Scenario A (smoke)", () => {
  test("inbox loads", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });
});
