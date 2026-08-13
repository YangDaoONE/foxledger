import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StateBlock } from "@/components/ui/StateBlock";

describe("React 测试环境", () => {
  it("渲染状态标题、说明和语义样式", () => {
    const { container } = render(
      <StateBlock title="同步失败" tone="warning">
        显示上次缓存
      </StateBlock>,
    );

    expect(screen.getByText("同步失败")).toBeInTheDocument();
    expect(screen.getByText("显示上次缓存")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("state-block", "warning");
  });
});
