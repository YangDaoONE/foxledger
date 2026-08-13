import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SyncStatusBanner } from "@/features/sync/SyncStatusBanner";

const baseProps = {
  isOnline: true,
  isSyncing: false,
  lastSuccessfulSyncAt: "2026-08-13T07:00:00.000Z",
  onRetry: vi.fn(),
  rowCount: 115,
  syncError: null,
  syncPhase: null,
};

describe("M4 同步状态条", () => {
  it("展示已同步缓存、行数和最近成功时间", () => {
    render(<SyncStatusBanner {...baseProps} />);

    expect(screen.getByText("已同步缓存")).toBeInTheDocument();
    expect(screen.getByText(/115 条账单 · 最近成功/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
  });

  it("离线时保留离线缓存核心状态", () => {
    render(<SyncStatusBanner {...baseProps} isOnline={false} />);

    expect(screen.getByText("离线缓存")).toBeInTheDocument();
    expect(screen.getByText(/115 条账单/)).toBeInTheDocument();
  });

  it("同步中报告阶段并设置 busy 状态", () => {
    const { container } = render(
      <SyncStatusBanner
        {...baseProps}
        isSyncing
        syncPhase="fetching-remote"
      />,
    );

    expect(screen.getByText("同步中")).toBeInTheDocument();
    expect(screen.getByText("正在读取云端账单")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("首次同步尚未建立成功记录时仍报告 busy 状态", () => {
    const { container } = render(
      <SyncStatusBanner {...baseProps} lastSuccessfulSyncAt={null} />,
    );

    expect(screen.getByText("正在准备本地缓存")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("失败时解释原因并允许手动重试", () => {
    const handleRetry = vi.fn();
    render(
      <SyncStatusBanner
        {...baseProps}
        onRetry={handleRetry}
        syncError="网络连接失败，请检查网络后重试。"
      />,
    );

    expect(screen.getByText("同步失败，显示上次缓存")).toBeInTheDocument();
    expect(screen.getByText(/网络连接失败，请检查网络后重试/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
