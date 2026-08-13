import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const repositoryRoot = cwd();

function readRepositoryFile(relativePath: string) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

describe("M4 设计与 PWA 表现契约", () => {
  const styles = readRepositoryFile("src/styles/globals.css");

  it("集中定义品牌、财务语义、间距、圆角和阴影 token", () => {
    for (const token of [
      "--brand",
      "--brand-soft",
      "--expense",
      "--income",
      "--transfer",
      "--balance",
      "--space-4",
      "--radius-md",
      "--shadow-sm",
    ]) {
      expect(styles).toContain(token);
    }
  });

  it("支出卡片和金额使用支出语义色而不是品牌橙", () => {
    expect(styles).toMatch(
      /\.transaction-card\.expense\s*{[^}]*var\(--expense\)/s,
    );
    expect(styles).toMatch(
      /\.transaction-amount\.expense\s*{[^}]*var\(--expense\)/s,
    );
    expect(styles).toMatch(/\.metric-card\.expense\s*{[^}]*var\(--expense-soft\)/s);
  });

  it("支持可见焦点、减少动画和移动端安全区", () => {
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain("env(safe-area-inset-top)");
  });
});
