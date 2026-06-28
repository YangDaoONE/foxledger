import { useState } from "react";
import { Sparkles } from "lucide-react";

import { AppButton } from "@/components/ui/AppButton";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { ConfirmTransactionBatch } from "@/features/ai/ConfirmTransactionBatch";
import {
  MAX_PARSED_TRANSACTIONS,
  MAX_PARSE_INPUT_CHARS,
  parseTransactionsWithAi,
} from "@/features/ai/parseTransactionApi";
import type { ParsedTransaction } from "@/features/ai/types";

type AiParsePanelProps = {
  isOnline: boolean;
  onSaved: () => Promise<void>;
  userId: string;
};

export function AiParsePanel({ isOnline, onSaved, userId }: AiParsePanelProps) {
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<ParsedTransaction[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  async function handleParse() {
    const trimmed = text.trim();

    if (!isOnline) {
      setMessage("离线时不能使用 AI 解析。");
      return;
    }

    if (!trimmed) {
      setMessage("请输入要解析的账单文本。");
      return;
    }

    if (trimmed.length > MAX_PARSE_INPUT_CHARS) {
      setMessage(`输入不能超过 ${MAX_PARSE_INPUT_CHARS} 字。`);
      return;
    }

    setIsParsing(true);
    setMessage(null);

    try {
      const result = await parseTransactionsWithAi(trimmed);
      setCandidates(result.transactions);
      if (result.transactions.length === 0) {
        setMessage("没有解析到账单，请换一种写法再试。");
      } else {
        setMessage(result.truncated ? "结果已按候选数量上限截断。" : null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 解析失败。");
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <SectionBlock eyebrow="AI" title="文本记账">
      <textarea
        className="ai-textarea"
        disabled={!isOnline || isParsing}
        onChange={(event) => setText(event.target.value)}
        placeholder="例如：今天午饭 32，地铁 6，工资 8000"
        value={text}
      />
      <div className="meta-row">
        <span>最多 {MAX_PARSED_TRANSACTIONS} 条候选</span>
        <span>
          {text.length} / {MAX_PARSE_INPUT_CHARS}
        </span>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      <AppButton
        disabled={!isOnline || isParsing}
        icon={<Sparkles size={16} />}
        type="button"
        onClick={handleParse}
      >
        {isParsing ? "解析中..." : "解析文本"}
      </AppButton>

      <ConfirmTransactionBatch
        isOnline={isOnline}
        onClear={() => setCandidates([])}
        onSaved={async () => {
          await onSaved();
          setText("");
        }}
        transactions={candidates}
        userId={userId}
      />
    </SectionBlock>
  );
}
