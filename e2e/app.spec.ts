import { expect, test } from "@playwright/test";

import {
  DEFAULT_LEDGER_ID,
  TRAVEL_LEDGER_ID,
  installSupabaseMocks,
  login,
} from "./helpers";

let foxChatRequests: Array<Record<string, unknown>>;
let transactionWrites: Array<Array<Record<string, unknown>>>;

test.beforeEach(async ({ page }) => {
  ({ foxChatRequests, transactionWrites } = await installSupabaseMocks(page));
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

test("设置页布局保持完整分区", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "设置" }).click();

  const introBox = await page.locator(".settings-page > .page-intro").boundingBox();
  const managementBox = await page.locator(".ledger-management").boundingBox();
  const privacyBox = await page.locator(".settings-privacy").boundingBox();
  const importBox = await page.locator(".settings-import").boundingBox();

  expect(introBox).not.toBeNull();
  expect(managementBox).not.toBeNull();
  expect(privacyBox).not.toBeNull();
  expect(importBox).not.toBeNull();

  if (!introBox || !managementBox || !privacyBox || !importBox) {
    return;
  }

  expect(managementBox.width).toBeGreaterThan(introBox.width * 0.95);

  if ((page.viewportSize()?.width ?? 0) >= 900) {
    expect(Math.abs(privacyBox.y - importBox.y)).toBeLessThan(2);
  } else {
    expect(importBox.y).toBeGreaterThan(privacyBox.y);
  }
});

test("当前账本切换会隔离首页统计，手动记账可定向到非当前账本", async ({ page }) => {
  await login(page);
  const switcher = page.getByRole("button", {
    name: "切换当前账本，当前为默认账本",
  });
  await expect(switcher).toBeVisible();

  await page.getByRole("button", { name: "手动记账" }).click();
  await page.getByLabel("记入账本").selectOption(TRAVEL_LEDGER_ID);
  await page.getByLabel("金额").fill("12");
  await page.getByRole("button", { name: "保存账单" }).click();
  await expect(switcher).toBeVisible();
  await expect(page.locator(".home-summary")).toContainText("¥38.00");

  await switcher.click();
  await page.getByRole("button", { name: "旅行账本" }).click();
  await expect(
    page.getByRole("button", { name: "切换当前账本，当前为旅行账本" }),
  ).toBeVisible();
  await expect(page.locator(".home-summary")).toContainText("¥12.00");
  await expect(page.locator(".home-summary")).not.toContainText("¥38.00");
});

test("设置页可以新建、重命名和删除空账本", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "设置" }).click();
  const management = page.locator(".ledger-management");
  await management.getByLabel("新账本名称").fill("工作账本");
  await management.getByRole("button", { name: "新建账本" }).click();

  let row = management.locator(".ledger-management-row").filter({
    hasText: "工作账本",
  });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "重命名" }).click();
  await row.getByLabel("新账本名称").fill("工作与学习");
  await row.getByRole("button", { name: "保存" }).click();

  row = management.locator(".ledger-management-row").filter({
    hasText: "工作与学习",
  });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { exact: true, name: "确认" }).click();
  await expect(row).toHaveCount(0);
});

test("CSV 所有合法行导入指定账本且不改变当前账本", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "设置" }).click();
  await page.getByLabel("导入到").selectOption(TRAVEL_LEDGER_ID);
  await page.getByLabel("选择 CSV 文件").setInputFiles({
    buffer: Buffer.from(
      "date,amount,type,category,merchant\n2026-08-22,19,expense,餐饮,旅行午餐",
    ),
    mimeType: "text/csv",
    name: "travel.csv",
  });
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(page.getByText("已导入 1 条账单。")).toBeVisible();

  expect(transactionWrites).toHaveLength(1);
  expect(transactionWrites[0]).toEqual([
    expect.objectContaining({ ledger_id: TRAVEL_LEDGER_ID }),
  ]);
  await expect(
    page.getByRole("button", { name: "切换当前账本，当前为默认账本" }),
  ).toBeVisible();
});

test("问账只发送结构化当前请求、依据可展开且会话刷新后清空", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();

  const composer = page.getByLabel("告诉狐狐要记的账或要问的账");
  await composer.fill("本月餐饮花了多少钱");
  await page.getByRole("button", { name: "发送给狐狐" }).click();

  const queryDisclosure = page.getByRole("button", {
    name: "展开问账结果：本月餐饮支出 ¥32.00。",
  });
  await expect(queryDisclosure).toBeVisible();
  await expect(queryDisclosure).toHaveAttribute("aria-expanded", "false");
  expect(foxChatRequests).toHaveLength(1);
  expect(Object.keys(foxChatRequests[0]).sort()).toEqual([
    "ledger_id",
    "previous_context",
    "text",
  ]);
  expect(foxChatRequests[0]).toEqual({
    ledger_id: DEFAULT_LEDGER_ID,
    previous_context: null,
    text: "本月餐饮花了多少钱",
  });

  await queryDisclosure.click();
  const queryCard = page.locator(".ledger-query-card");
  await expect(queryCard.locator(".ledger-query-answer")).toContainText(
    "本月餐饮支出 ¥32.00。",
  );
  const primaryMetrics = queryCard.getByRole("group", {
    name: "本月餐饮主要指标",
  });
  await expect(primaryMetrics).toContainText("支出");
  await expect(primaryMetrics).not.toContainText("收入");

  await queryCard.getByText("更多统计", { exact: true }).click();
  const moreStats = queryCard.locator(".ledger-query-more-stats");
  await expect(moreStats).toHaveAttribute("open", "");
  await expect(moreStats).toContainText("支出");
  await expect(moreStats).toContainText("收入");
  await expect(moreStats).toContainText("结余");
  await expect(moreStats).toContainText("账单数");
  await expect(moreStats).toContainText("日均支出");
  await expect(moreStats).toContainText("最大支出");
  await page.getByRole("button", { name: "查看依据" }).click();
  await expect(page.getByText("小狐餐厅", { exact: true })).toBeVisible();
  await expect(page.getByText("回答引用", { exact: true })).toBeVisible();

  await page.getByRole("button", {
    name: "切换当前账本，当前为默认账本",
  }).click();
  await page.getByRole("button", { name: "旅行账本" }).click();
  await expect(
    page.getByRole("button", { name: "切换当前账本，当前为旅行账本" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开匹配账单" }).click();
  await expect(page).toHaveURL(/\/transactions\?.*category=/);
  await expect(
    page.getByRole("button", { name: "切换当前账本，当前为默认账本" }),
  ).toBeVisible();
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();
  await expect(
    page.getByRole("button", {
      name: "展开问账结果：本月餐饮支出 ¥32.00。",
    }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("想记账或问账，都可以直接说", { exact: true }),
  ).toBeVisible();
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

  await page.getByRole("button", {
    name: "切换当前账本，当前为默认账本",
  }).click();
  await page.getByRole("button", { name: "旅行账本" }).click();
  await expect(
    page.getByRole("button", { name: "切换当前账本，当前为旅行账本" }),
  ).toBeVisible();

  await context.setOffline(false);
  await expect(
    page.locator(".sync-banner").getByText("已同步缓存", { exact: true }),
  ).toBeVisible();
});

test("Composer 自动增高并保持常见键盘发送行为", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();
  const composer = page.getByLabel("告诉狐狐要记的账或要问的账");
  const initialHeight = await composer.evaluate((element) =>
    element.getBoundingClientRect().height,
  );

  await composer.fill("第一行\n第二行\n第三行");
  const expandedHeight = await composer.evaluate((element) =>
    element.getBoundingClientRect().height,
  );
  expect(expandedHeight).toBeGreaterThan(initialHeight);

  await composer.fill("一\n二\n三\n四\n五\n六");
  const overflowMetrics = await composer.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return {
      clientHeight: textarea.clientHeight,
      maxHeight: Number.parseFloat(getComputedStyle(textarea).maxHeight),
      renderedHeight: textarea.getBoundingClientRect().height,
      scrollHeight: textarea.scrollHeight,
    };
  });
  expect(overflowMetrics.renderedHeight).toBeLessThanOrEqual(overflowMetrics.maxHeight);
  expect(overflowMetrics.scrollHeight).toBeGreaterThan(overflowMetrics.clientHeight);

  await composer.fill("短输入");
  const collapsedHeight = await composer.evaluate((element) =>
    element.getBoundingClientRect().height,
  );
  expect(collapsedHeight).toBeLessThan(expandedHeight);

  await composer.fill("第一行");
  await composer.press("Shift+Enter");
  await composer.type("第二行");
  await expect(composer).toHaveValue("第一行\n第二行");
  expect(foxChatRequests).toHaveLength(0);

  await composer.fill("本月餐饮花了多少钱");
  await composer.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "展开问账结果：本月餐饮支出 ¥32.00。",
    }),
  ).toBeVisible();
  expect(foxChatRequests).toHaveLength(1);
});

test("保存后的聊天结果自动收起，展开后仍可进入正式详情", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();
  await page.getByLabel("告诉狐狐要记的账或要问的账").fill("今天吃饭25，打车40");
  await page.getByRole("button", { name: "发送给狐狐" }).click();
  await expect(page.getByText("2 笔候选", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "确认记账" }).click();
  const disclosure = page.getByRole("button", {
    name: /本次记账结果：已记录 2 笔 · 支出 ¥65\.00/,
  });
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "详情" })).toBeVisible();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false", {
    timeout: 4500,
  });

  await page.setViewportSize({ height: 720, width: 320 });
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  await disclosure.click();
  await page.getByRole("button", { name: "详情" }).click();
  await expect(page.getByRole("heading", { name: "正式账单详情" })).toBeVisible();
});

test("AI 候选可整批记入非当前账本，且不会切换当前浏览范围", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { exact: true, name: "狐狐" }).click();
  await page.getByLabel("告诉狐狐要记的账或要问的账").fill("今天吃饭25，打车40");
  await page.getByRole("button", { name: "发送给狐狐" }).click();
  await page.getByLabel("记入账本").selectOption(TRAVEL_LEDGER_ID);
  await page.getByRole("button", { name: "确认记账" }).click();
  await expect(page.getByRole("button", { name: /本次记账结果/ })).toBeVisible();

  expect(transactionWrites).toHaveLength(1);
  expect(
    transactionWrites[0].every(
      (transaction) => transaction.ledger_id === TRAVEL_LEDGER_ID,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "切换当前账本，当前为默认账本" }),
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

  await page.getByRole("button", { name: /切换当前账本/ }).click();
  await expect(page.getByRole("dialog", { name: "切换当前账本" })).toBeVisible();
  const switcherOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(switcherOverflow.scrollWidth).toBeLessThanOrEqual(switcherOverflow.clientWidth);
  await page.getByRole("button", { name: "关闭账本切换" }).click();

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
