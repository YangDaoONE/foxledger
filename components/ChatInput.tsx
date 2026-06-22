import { PenLine, Send, Sparkles } from "lucide-react";

export function ChatInput() {
  return (
    <section className="chat-panel" aria-labelledby="ai-input-title">
      <div className="section-heading">
        <p>AI 记账</p>
        <h2 id="ai-input-title">一句话记一笔</h2>
      </div>

      <label className="chat-input-label" htmlFor="mock-ai-input">
        <Sparkles size={18} aria-hidden="true" />
        <span>输入示例</span>
      </label>
      <textarea
        id="mock-ai-input"
        placeholder="例如：今天中午麦当劳花了 38，支付宝"
        rows={3}
      />

      <div className="action-row">
        <button className="secondary-button" type="button">
          <PenLine size={18} aria-hidden="true" />
          手动记账
        </button>
        <button className="primary-button" type="button">
          <Send size={18} aria-hidden="true" />
          解析
        </button>
      </div>
    </section>
  );
}
