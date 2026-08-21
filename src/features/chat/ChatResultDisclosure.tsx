import {
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";

type ChatResultDisclosureProps = {
  autoCollapseMs?: number;
  autoCollapseSignal?: number | null;
  children?: ReactNode;
  className?: string;
  compactContent: ReactNode;
  defaultExpanded?: boolean;
  label: string;
};

export function ChatResultDisclosure({
  autoCollapseMs = 3000,
  autoCollapseSignal = null,
  children,
  className = "",
  compactContent,
  defaultExpanded = false,
  label,
}: ChatResultDisclosureProps) {
  const contentId = useId();
  const isExpandable = children !== undefined && children !== null;
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded && isExpandable,
  );
  const autoCollapseTimerRef = useRef<number | null>(null);

  const cancelAutoCollapse = useCallback(() => {
    if (autoCollapseTimerRef.current === null) {
      return;
    }

    window.clearTimeout(autoCollapseTimerRef.current);
    autoCollapseTimerRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!isExpandable || autoCollapseSignal === null) {
      return;
    }

    cancelAutoCollapse();
    setIsExpanded(true);
    autoCollapseTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      autoCollapseTimerRef.current = null;
    }, autoCollapseMs);

    return cancelAutoCollapse;
  }, [
    autoCollapseMs,
    autoCollapseSignal,
    cancelAutoCollapse,
    isExpandable,
  ]);

  function handleInteractionCapture() {
    cancelAutoCollapse();
  }

  return (
    <div
      className={`chat-result-disclosure ${isExpanded ? "is-expanded" : ""} ${className}`.trim()}
      onFocusCapture={handleInteractionCapture}
      onPointerDownCapture={handleInteractionCapture}
    >
      {isExpandable ? (
        <button
          aria-controls={contentId}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "收起" : "展开"}${label}`}
          className="chat-result-disclosure-toggle"
          type="button"
          onClick={() => {
            cancelAutoCollapse();
            setIsExpanded((current) => !current);
          }}
        >
          <span className="chat-result-disclosure-content">{compactContent}</span>
          <ChevronDown
            aria-hidden="true"
            className="chat-result-disclosure-chevron"
            size={18}
            strokeWidth={2.2}
          />
        </button>
      ) : (
        <div className="chat-result-disclosure-static" role="status">
          <span className="chat-result-disclosure-content">{compactContent}</span>
        </div>
      )}

      {isExpandable ? (
        <div
          aria-hidden={!isExpanded}
          className="chat-result-disclosure-panel"
          id={contentId}
          inert={!isExpanded}
        >
          <div className="chat-result-disclosure-panel-inner">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
