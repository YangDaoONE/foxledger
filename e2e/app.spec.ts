import { expect, test } from "@playwright/test";

import { installSupabaseMocks, login } from "./helpers";

let foxChatRequests: Array<Record<string, unknown>>;

test.beforeEach(async ({ page }) => {
  ({ foxChatRequests } = await installSupabaseMocks(page));
});

test("登录后可遍历核心页面并保持原有统计口径", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("heading", { name: "收支清楚，记账轻松" })).toBeVisible();
  await expect(page.getByText("¥38.00", { exact: true })).toBeVisible();
  await expect(page.getByText("¥100.00", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "账单" }).click();
  await expect(page.getByRole("heading", { name: "每一笔都有来处" })).toBeVisible();
  await expect(page.getByText("小狐餐厅", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "统计" }).click();
  await expect(page.getByRole("heading", { name: "看见收支的节奏" })).toBeVisible();
  await expect(page.getByRole("button", { name: /总支出.*¥38\.00/ })).toBeVisible();

  await page.getByRole("link", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "账号与数据边界" })).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText(/最近同步/)).toBeVisible();
});

test("问账只发送结构化当前请求、依据可展开且会话刷新后清空", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();

  const composer = page.getByLabel("告诉狐狐要记的账或要问的账");
  await composer.fill("本月餐饮花了多少钱");
  await page.getByRole("button", { name: "发送给狐狐" }).click();

  await expect(page.getByText("本月餐饮支出 ¥32.00。", { exact: true })).toBeVisible();
  expect(foxChatRequests).toHaveLength(1);
  expect(Object.keys(foxChatRequests[0]).sort()).toEqual([
    "previous_context",
    "text",
  ]);
  expect(foxChatRequests[0]).toEqual({
    previous_context: null,
    text: "本月餐饮花了多少钱",
  });

  await page.getByRole("button", { name: "查看依据" }).click();
  await expect(page.getByText("小狐餐厅", { exact: true })).toBeVisible();
  await expect(page.getByText("回答引用", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "打开匹配账单" }).click();
  await expect(page).toHaveURL(/\/transactions\?.*category=/);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();
  await expect(page.getByText("本月餐饮支出 ¥32.00。", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("记一笔，或问问账本", { exact: true })).toBeVisible();
  await expect(page.getByText("本月餐饮支出 ¥32.00。", { exact: true })).toHaveCount(0);
});

test("离线时只读缓存、禁用狐狐，恢复联网后自动同步", async ({ context, page }) => {
  await login(page);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();
  await context.setOffline(true);
  await expect(
    page.locator(".sync-banner").getByText("离线缓存", { exact: true }),
  ).toBeVisible();

  await expect(page.getByText(/当前离线，只能查看/)).toBeVisible();
  await expect(page.getByLabel("告诉狐狐要记的账或要问的账")).toBeDisabled();

  await context.setOffline(false);
  await expect(
    page.locator(".sync-banner").getByText("已同步缓存", { exact: true }),
  ).toBeVisible();
});

test("页面不横向溢出且键盘焦点可见", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ height: 720, width: 320 });

  for (const destination of ["首页", "账单", "统计", "设置", "狐狐"]) {
    await page.getByRole("link", { exact: true, name: destination }).click();
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.scrollWidth, `${destination}页面不应横向溢出`).toBeLessThanOrEqual(
      overflow.clientWidth,
    );
  }

  const composer = page.getByLabel("告诉狐狐要记的账或要问的账");
  await composer.focus();
  const focusStyle = await composer.evaluate((element) => {
    const wrapper = element.closest(".chat-composer");
    return wrapper ? getComputedStyle(wrapper).boxShadow : "";
  });
  expect(focusStyle).not.toBe("none");
});

test("退出登录后回到登录页并清空当前用户缓存", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "设置" }).click();
  await page.getByRole("button", { name: "退出登录" }).click();

  await expect(page.getByRole("heading", { name: "狐狐记账" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
});
