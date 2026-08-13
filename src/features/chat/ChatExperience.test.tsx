import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/ai/parseTransactionApi", () => ({
  MAX_PARSE_INPUT_CHARS: 3000,
}));

import { ChatComposer } from "@/features/chat/ChatComposer";
import { ChatMessageList } from "@/features/chat/ChatMessageList";
import { FoxMascot, type FoxMascotState } from "@/features/chat/FoxMascot";
import type { ChatMessage } from "@/features/chat/chatTypes";

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
      isOnline: true,
      onConfirmBatch: vi.fn(),
      onCorrectIntent: vi.fn(),
      onOpenCandidate: vi.fn(),
      onOpenQueryTransactions: vi.fn(),
      onRemoveCandidate: vi.fn(),
      onRetryBatchSync: vi.fn(),
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
