import { chromium } from "playwright";

const BASE = "http://localhost:5173";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // 1. Splash screen
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/screenshot-01-splash.png", fullPage: true });
  console.log("✅ Splash screen captured");

  // 2. Eligibility - Ovary
  await page.click('button:has-text("Get Started")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-02-eligibility-ovary.png", fullPage: true });
  console.log("✅ Eligibility Ovary captured");

  // 3. Eligibility - Pregnancy
  await page.click('button:has-text("Yes")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-03-eligibility-pregnancy.png", fullPage: true });
  console.log("✅ Eligibility Pregnancy captured");

  // 4. Eligibility - Age
  await page.click('button:has-text("No")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-04-eligibility-age.png", fullPage: true });
  console.log("✅ Eligibility Age captured");

  // 5. Fill age and continue
  await page.fill('input[type="number"]', '28');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-05-clinical-form.png", fullPage: true });
  console.log("✅ Clinical Form captured");

  // 6. Fill clinical form
  await page.fill('input#heightCm', '165');
  await page.fill('input#weightKg', '65');
  await page.fill('input#pregnancies', '0');
  await page.fill('input#births', '0');

  // Click family history checkbox via its label
  await page.click('label:has-text("Family history of ovarian or breast cancer")');
  await page.waitForTimeout(200);

  // Check symptoms via labels
  await page.click('label:has-text("Irregular or absent menstrual cycles")');
  await page.waitForTimeout(100);
  await page.click('label:has-text("Pelvic pain or bloating lasting over 3 weeks")');
  await page.waitForTimeout(100);

  await page.screenshot({ path: "/tmp/screenshot-06-clinical-form-filled.png", fullPage: true });
  console.log("✅ Clinical Form filled captured");

  // Submit
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-07-ultrasound.png", fullPage: true });
  console.log("✅ Ultrasound captured");

  // Skip ultrasound (first click shows warning)
  await page.locator('button:has-text("Skip")').click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-08-skip-warning.png", fullPage: true });
  console.log("✅ Skip warning captured");

  // Skip again to proceed (use force to bypass any overlay)
  await page.locator('button:has-text("Skip")').last().click({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-09-review.png", fullPage: true });
  console.log("✅ Review screen captured");

  // Check consent via label
  await page.click('label:has-text("I understand")');
  await page.waitForTimeout(200);

  // See results
  await page.click('button:has-text("See Results")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/screenshot-10-results.png", fullPage: true });
  console.log("✅ Results screen captured");

  await browser.close();
  console.log("🎉 All 10 screenshots captured!");
}

run().catch(console.error);