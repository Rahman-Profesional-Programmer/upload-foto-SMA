const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  const appOrigin = new URL(test.info().project.use.baseURL).origin;
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).origin === appOrigin) {
      return route.continue();
    }
    return route.abort();
  });
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
