import { expect, test } from "playwright/test";

test("renders real backend evidence without browser persistence", async ({ page }) => {
  await page.goto("http://127.0.0.1:5174");
  await expect(page.getByText("Do you currently have at least one ovary?")).toBeVisible({timeout:10_000});
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "No" }).click();
  await page.getByPlaceholder("e.g. 25").fill("29");
  await page.getByRole("button", { name: "Done" }).click();
  await page.locator("#heightCm").fill("163");
  await page.locator("#weightKg").fill("68");
  await page.getByRole("button", { name: "Irregular" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.locator("#consent").click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Analysis results" })).toBeVisible({timeout:30_000});
  await expect(page.getByRole("heading", { name: "Model output" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "XGBoost clinical screening" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Interpretation unavailable" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("ovia-form-state"))).toBeNull();
});
