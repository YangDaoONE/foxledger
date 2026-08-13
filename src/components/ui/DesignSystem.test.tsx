import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MetricCard } from "@/components/ui/MetricCard";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionBlock } from "@/components/ui/SectionBlock";

describe("M4 共享表现组件", () => {
  it("以统一页面头展示标题、说明和操作", () => {
    render(
      <PageIntro
        actions={<button type="button">新建</button>}
        description="查看当前账本"
        eyebrow="首页"
        icon={<span>图标</span>}
        title="本月概览"
      />,
    );

    expect(screen.getByRole("heading", { name: "本月概览" })).toBeInTheDocument();
    expect(screen.getByText("查看当前账本")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建" })).toBeInTheDocument();
  });

  it("保留财务语义色并支持统计下钻", () => {
    const handleClick = vi.fn();

    render(
      <MetricCard
        helper="点击查看账单"
        label="支出"
        onClick={handleClick}
        tone="expense"
        value="¥32.00"
      />,
    );

    const card = screen.getByRole("button", { name: /支出/ });
    expect(card).toHaveClass("metric-card", "expense");
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("区块标题支持说明和独立操作", () => {
    render(
      <SectionBlock
        action={<button type="button">刷新</button>}
        className="account-section"
        description="只显示当前用户数据"
        eyebrow="账号"
        title="登录信息"
      >
        <p>正文</p>
      </SectionBlock>,
    );

    expect(screen.getByRole("heading", { name: "登录信息" })).toBeInTheDocument();
    expect(screen.getByText("只显示当前用户数据")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
    expect(screen.getByText("正文").closest("section")).toHaveClass("account-section");
  });
});
