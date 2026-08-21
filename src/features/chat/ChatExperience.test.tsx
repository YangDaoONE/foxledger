import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/ai/parseTransactionApi", () => ({
  MAX_PARSE_INPUT_CHARS: 3000,
}));

import { ChatComposer } from "@/features/chat/ChatComposer";
import { ChatMessageList } from "@/features/chat/ChatMessageList";
import { FoxMascot, type FoxMascotState } from "@/features/chat/FoxMascot";
import type { ChatMessage } from "@/features/chat/chatTypes";

const LEDGER_ID = "33333333-3333-4333-8333-333333333333";
const ledgers = [
  {
    cache_key: `user-1:${LEDGER_ID}`,
    created_at: "2026-08-22T00:00:00.000Z",
    id: LEDGER_ID,
    name: "默认账本",
    updated_at: "2026-08-22T00:00:00.000Z",
    user_id: "user-1",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as { scrollTo?: HTMLElement["scrollTo"] }).scrollTo;
});

describe("狐狐状态视觉", () => {
  it.each<FoxMascotState>(["normal", "listening", "thinking", "happy", "confused"])(
    "渲染 %s 状态并保持装饰图对读屏隐藏",
    (state) => {
      const { container } = render(<FoxMascot state={state} />);
      const mascot = container.querySelector(`.fox-mascot.${state}`);

      expect(mascot).toHaveAttribute("aria-hidden", "true");

      if (state === "listening") {
        expect(container.querySelectorAll(".fox-signal")).toHaveLength(2);
      }

      if (state === "confused") {
        expect(container.querySelector(".fox-question")).toHaveTextContent("?");
      }
    },
  );
});

describe("Chat 移动端交互", () => {
  it("空状态优先说明可以记账和问账，不展示工程协议", () => {
    render(
      <ChatMessageList
        hasStaleBatchCache={false}
        isBatchCacheSyncing={false}
        isOnline
        ledgers={ledgers}
        messages={[]}
        onConfirmBatch={vi.fn()}
        onCorrectIntent={vi.fn()}
        onOpenCandidate={vi.fn()}
        onOpenQueryTransactions={vi.fn()}
        onOpenSavedBatch={vi.fn()}
        onRemoveCandidate={vi.fn()}
        onRetryBatchSync={vi.fn()}
        onUpdateBatchLedger={vi.fn()}
        userId="user-1"
      />,
    );

    expect(screen.getByText("想记账或问账，都可以直接说")).toBeInTheDocument();
    expect(screen.getByText("“午饭 32”")).toBeInTheDocument();
    expect(screen.getByText("“这个月餐饮花了多少？”")).toBeInTheDocument();
    expect(screen.queryByText(/500 条五字段/)).not.toBeInTheDocument();
  });

  it("输入框聚焦和失焦会切换 listening 状态", () => {
    const onListeningChange = vi.fn();
    render(
      <ChatComposer
        isOnline
        isParsing={false}
        onListeningChange={onListeningChange}
        onSend={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText("告诉狐狐要记的账或要问的账");

    fireEvent.focus(textarea);
    fireEvent.blur(textarea);

    expect(onListeningChange.mock.calls).toEqual([[true], [false]]);
  });

  it("移动端从输入框点击发送时不会先移动输入区", () => {
    const onListeningChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <ChatComposer
        isOnline
        isParsing={false}
        onListeningChange={onListeningChange}
        onSend={onSend}
      />,
    );
    const textarea = screen.getByLabelText("告诉狐狐要记的账或要问的账");
    const sendButton = screen.getByRole("button", { name: "发送给狐狐" });

    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "本月餐饮花了多少" } });
    fireEvent.blur(textarea, { relatedTarget: sendButton });
    expect(onListeningChange.mock.calls).toEqual([[true]]);

    fireEvent.click(sendButton);
    expect(onSend).toHaveBeenCalledWith("本月餐饮花了多少");
    expect(onListeningChange.mock.calls).toEqual([[true], [false]]);
  });

  it("Enter 发送，Shift+Enter 保留原生换行", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ChatComposer isOnline isParsing={false} onSend={onSend} />);
    const textarea = screen.getByLabelText("告诉狐狐要记的账或要问的账");

    fireEvent.change(textarea, { target: { value: "午饭 32" } });
    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(false);
    expect(onSend).toHaveBeenCalledWith("午饭 32");

    fireEvent.change(textarea, { target: { value: "午饭 32" } });
    expect(fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })).toBe(true);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("IME 选词期间按 Enter 不发送，composition 结束后才发送", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ChatComposer isOnline isParsing={false} onSend={onSend} />);
    const textarea = screen.getByLabelText("告诉狐狐要记的账或要问的账");

    fireEvent.change(textarea, { target: { value: "午饭 32" } });
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { isComposing: true, key: "Enter", keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("午饭 32");
  });

  it("输入框在约 2–5 行之间增高，超出后内部滚动并可缩回", () => {
    render(<ChatComposer isOnline isParsing={false} onSend={vi.fn()} />);
    const textarea = screen.getByLabelText(
      "告诉狐狐要记的账或要问的账",
    ) as HTMLTextAreaElement;
    let scrollHeight = 100;
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    textarea.style.maxHeight = "130px";

    fireEvent.change(textarea, { target: { value: "第一行\n第二行\n第三行" } });
    expect(textarea.style.height).toBe("100px");
    expect(textarea.style.overflowY).toBe("hidden");

    scrollHeight = 180;
    fireEvent.change(textarea, {
      target: { value: "第一行\n第二行\n第三行\n第四行\n第五行\n第六行" },
    });
    expect(textarea.style.height).toBe("130px");
    expect(textarea.style.overflowY).toBe("auto");

    scrollHeight = 58;
    fireEvent.change(textarea, { target: { value: "短输入" } });
    expect(textarea.style.height).toBe("58px");
    expect(textarea.style.overflowY).toBe("hidden");
  });

  it("用户主动向上浏览后，新消息不会强制拉回底部", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    const firstMessages: ChatMessage[] = [
      {
        createdAt: "2026-08-13T01:00:00.000Z",
        id: "message-1",
        role: "user",
        text: "午饭 32",
        type: "text",
      },
    ];
    const props = {
      hasStaleBatchCache: false,
      isBatchCacheSyncing: false,
      isOnline: true,
      ledgers,
      onConfirmBatch: vi.fn(),
      onCorrectIntent: vi.fn(),
      onOpenCandidate: vi.fn(),
      onOpenQueryTransactions: vi.fn(),
      onOpenSavedBatch: vi.fn(),
      onRemoveCandidate: vi.fn(),
      onRetryBatchSync: vi.fn(),
      onUpdateBatchLedger: vi.fn(),
      userId: "user-1",
    };
    const view = render(<ChatMessageList {...props} messages={firstMessages} />);
    const list = view.container.querySelector(".chat-message-list");

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(list).not.toBeNull();
    Object.defineProperties(list!, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100, writable: true },
    });
    fireEvent.scroll(list!);
    view.rerender(
      <ChatMessageList
        {...props}
        messages={[
          ...firstMessages,
          {
            createdAt: "2026-08-13T01:00:01.000Z",
            id: "message-2",
            role: "assistant",
            text: "已识别",
            type: "text",
          },
        ]}
      />,
    );

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
