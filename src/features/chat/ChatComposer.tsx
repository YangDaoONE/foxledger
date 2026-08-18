import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Send } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { MAX_FOX_CHAT_INPUT_CHARS } from "@/features/chat/foxChatConstants";

type ChatComposerProps = {
  isOnline: boolean;
  isParsing: boolean;
  onListeningChange?: (isListening: boolean) => void;
  onSend: (text: string) => Promise<void>;
};

export function ChatComposer({
  isOnline,
  isParsing,
  onListeningChange,
  onSend,
}: ChatComposerProps) {
  const [text, setText] = useState("");
  const composerRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const trimmed = text.trim();

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    function keepComposerVisible() {
      if (!isFocusedRef.current) {
        return;
      }

      requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView?.({ block: "nearest" });
      });
    }

    viewport.addEventListener("resize", keepComposerVisible);
    viewport.addEventListener("scroll", keepComposerVisible);

    return () => {
      viewport.removeEventListener("resize", keepComposerVisible);
      viewport.removeEventListener("scroll", keepComposerVisible);
    };
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const maxHeight = Number.parseFloat(window.getComputedStyle(textarea).maxHeight);
    const nextHeight = Number.isFinite(maxHeight)
      ? Math.min(textarea.scrollHeight, maxHeight)
      : textarea.scrollHeight;

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      Number.isFinite(maxHeight) && textarea.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  }, [text]);

  function handleSubmit() {
    if (!trimmed || !isOnline || isParsing) {
      return;
    }

    setText("");
    onListeningChange?.(false);
    void onSend(trimmed);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    if (
      event.nativeEvent.isComposing ||
      isComposingRef.current ||
      event.nativeEvent.keyCode === 229
    ) {
      return;
    }

    event.preventDefault();
    handleSubmit();
  }

  return (
    <form
      className="chat-composer"
      ref={composerRef}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <label className="chat-composer-field">
        <span className="sr-only">告诉狐狐要记的账或要问的账</span>
        <textarea
          aria-describedby="chat-composer-meta"
          disabled={!isOnline || isParsing}
          enterKeyHint="send"
          inputMode="text"
          maxLength={MAX_FOX_CHAT_INPUT_CHARS}
          onChange={(event) => setText(event.target.value)}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onKeyDown={handleKeyDown}
          placeholder={isOnline ? "例如：午饭 32；或问：本月餐饮花了多少" : "联网后可以和狐狐记账或问账"}
          rows={2}
          ref={textareaRef}
          value={text}
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof Node &&
              composerRef.current?.contains(event.relatedTarget)
            ) {
              return;
            }

            isFocusedRef.current = false;
            onListeningChange?.(false);
          }}
          onFocus={() => {
            isFocusedRef.current = true;
            onListeningChange?.(true);
            requestAnimationFrame(() => {
              composerRef.current?.scrollIntoView?.({ block: "nearest" });
            });
          }}
        />
      </label>
      <div className="chat-composer-actions">
        <span id="chat-composer-meta">
          {text.length} / {MAX_FOX_CHAT_INPUT_CHARS}
        </span>
        <AppButton
          aria-label="发送给狐狐"
          disabled={!trimmed || !isOnline || isParsing}
          icon={<Send size={17} />}
          type="submit"
        >
          {isParsing ? "理解中" : "发送"}
        </AppButton>
      </div>
    </form>
  );
}
