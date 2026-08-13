import { expect, test } from "@playwright/test";

test("生产构建提供 standalone manifest 与可离线恢复的应用壳", async ({
  context,
  page,
}) => {
  const manifestResponse = await context.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#B5571D");
  expect(manifest.background_color).toBe("#FBF7F0");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ purpose: "any maskable", src: "/icon.svg" }),
    ]),
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "狐狐记账" })).toBeVisible();
  const workerUrl = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? "";
  });
  expect(workerUrl).toMatch(/\/sw\.js$/);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "狐狐记账" })).toBeVisible();
  await context.setOffline(false);
});
