const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("shows the upload form and available alumni years", async ({ page }) => {
  await expect(page).toHaveURL("https://rahman-profesional-programmer.github.io/upload-foto-SMA/");
  await expect(page.getByRole("heading", { name: "Alumni SMAN 1 Amuntai" })).toBeVisible();
  await expect(page.locator("#year-select option")).toHaveCount(42);
  await expect(page.locator("#submit-button")).toBeDisabled();
});

test("switches tabs with click and arrow-key navigation", async ({ page }) => {
  const uploadTab = page.getByRole("tab", { name: "Unggah foto" });
  const foldersTab = page.getByRole("tab", { name: "Lihat folder Drive" });

  await foldersTab.click();
  await expect(foldersTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#folders-panel")).toBeVisible();
  await expect(page.locator("#upload-panel")).toBeHidden();

  await foldersTab.press("ArrowLeft");
  await expect(uploadTab).toHaveAttribute("aria-selected", "true");
  await expect(uploadTab).toBeFocused();
});

test("enables upload after choosing a year and valid photo, then removes it from the selection", async ({ page }) => {
  await page.locator("#year-select").selectOption("2000");
  await page.locator("#file-input").setInputFiles({
    name: "kenangan.png",
    mimeType: "image/png",
    buffer: Buffer.from("sample image")
  });

  await expect(page.locator("#file-list li")).toHaveCount(1);
  await expect(page.locator("#submit-button")).toBeEnabled();

  await page.getByRole("button", { name: "Hapus kenangan.png" }).click();
  await expect(page.locator("#file-list li")).toHaveCount(0);
  await expect(page.locator("#submit-button")).toBeDisabled();
});

test("reports unsupported and oversized files", async ({ page }) => {
  await page.locator("#file-input").setInputFiles([
    {
      name: "dokumen.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not an image")
    },
    {
      name: "terlalu-besar.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1)
    }
  ]);

  await expect(page.locator("#notice")).toContainText("format harus JPG, PNG, atau WEBP");
  await expect(page.locator("#notice")).toContainText("ukuran melebihi 5 MB");
  await expect(page.locator("#file-list li")).toHaveCount(0);
});

test("limits the selection to ten photos", async ({ page }) => {
  await page.locator("#file-input").setInputFiles(
    Array.from({ length: 11 }, (_, index) => ({
      name: `foto-${index + 1}.png`,
      mimeType: "image/png",
      buffer: Buffer.from("sample image")
    }))
  );

  await expect(page.locator("#file-list li")).toHaveCount(10);
  await expect(page.locator("#notice")).toContainText("Maksimal 10 foto");
});

test("uploads both requested photos and verifies them in the Alumni 2012 Drive folder", async ({ page }) => {
  test.setTimeout(360_000);

  const photoPaths = [
    process.env.ALUMNI_2012_PHOTO_1 ||
      "C:\\Users\\PLH\\Downloads\\Smiling Scout Portrait on Campus.png",
    process.env.ALUMNI_2012_PHOTO_2 ||
      "C:\\Users\\PLH\\Downloads\\Welcoming Indah Cargo Customer Service.png"
  ].map((photoPath) => path.resolve(photoPath));

  for (const photoPath of photoPaths) {
    if (!fs.existsSync(photoPath)) {
      throw new Error(`Upload test photo not found: ${photoPath}`);
    }
  }

  await page.waitForFunction(() => typeof window.receiveAlumniUploadStatus === "function");
  await page.evaluate(() => {
    const receiveStatus = window.receiveAlumniUploadStatus;
    window.__alumniUploadResults = [];
    window.receiveAlumniUploadStatus = (result) => {
      if (result?.status && result.status !== "pending") {
        window.__alumniUploadResults.push(result);
      }
      receiveStatus(result);
    };
  });

  await page.locator("#year-select").selectOption("2012");
  await page.locator("#file-input").setInputFiles(photoPaths);
  await expect(page.locator("#file-list .file-name")).toHaveCount(2);
  await page.locator("#submit-button").click();
  await expect(page.locator("#progress-label")).toHaveText(
    "2 foto berhasil diunggah ke Alumni 2012.",
    { timeout: 270_000 }
  );

  const uploadResults = await page.evaluate(() => window.__alumniUploadResults);
  expect(uploadResults).toHaveLength(2);
  for (const result of uploadResults) {
    expect(result.status).toBe("success");
    expect(result.year).toBe("2012");
    expect(result.name).toMatch(/^Alumni_2012_.+\.png$/);
  }

  await page.goto("https://drive.google.com/drive/folders/1FwPkrifXPWrW7MwpmxC-K06t5Wk4WdCk");
  await expect(page).toHaveTitle("Alumni 2012 - Google Drive");
  for (const result of uploadResults) {
    await expect(page.locator("body")).toContainText(result.name, { timeout: 60_000 });
  }
});
