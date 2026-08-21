import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatResultDisclosure } from "@/features/chat/ChatResultDisclosure";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderDisclosure(autoCollapseSignal: number | null = null) {
  return render(
    <ChatResultDisclosure
      autoCollapseSignal={autoCollapseSignal}
      compactContent={<span>已记录 2 笔 · 支出 ¥65.00</span>}
      label="本次记账结果"
    >
      <button type="button">详情</button>
    </ChatResultDisclosure>,
  );
}

describe("聊天结果折叠", () => {
  it("收到展示信号后保持完整内容 3 秒，再自动收起且可重新展开", () => {
    vi.useFakeTimers();
    renderDisclosure(1);

    const toggle = screen.getByRole("button", { name: "收起本次记账结果" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "详情" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2999));
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    act(() => vi.advanceTimersByTime(1));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "详情" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "详情" })).toBeInTheDocument();
  });

  it("用户在倒计时内操作展开内容时取消自动收起", () => {
    vi.useFakeTimers();
    renderDisclosure(1);

    const toggle = screen.getByRole("button", { name: "收起本次记账结果" });
    const detail = screen.getByRole("button", { name: "详情" });
    fireEvent.pointerDown(detail);
    fireEvent.focus(detail);
    act(() => vi.advanceTimersByTime(3000));

    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("已保存结果重新挂载时默认直接紧凑显示", () => {
    const first = renderDisclosure();
    expect(
      screen.getByRole("button", { name: "展开本次记账结果" }),
    ).toHaveAttribute("aria-expanded", "false");

    first.unmount();
    renderDisclosure();

    expect(
      screen.getByRole("button", { name: "展开本次记账结果" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("reduced motion 下不依赖动画结束事件完成状态切换", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }),
    );
    renderDisclosure(1);

    const toggle = screen.getByRole("button", { name: "收起本次记账结果" });
    act(() => vi.advanceTimersByTime(3000));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
