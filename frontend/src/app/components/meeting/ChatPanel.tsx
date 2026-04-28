import type { EphemeralChatMessage } from "../../../features/chat/ephemeralChatStore";
import { motion } from "framer-motion";
import { MessageSquare, Send } from "lucide-react";

type ChatPanelProps = Readonly<{
  messageDraft: string;
  messages: EphemeralChatMessage[];
  onMessageDraftChange: (value: string) => void;
  onSendMessage: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}>;

export function ChatPanel({
  messageDraft,
  messages,
  onMessageDraftChange,
  onSendMessage,
}: ChatPanelProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
    >
      <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold">
        <MessageSquare size={18} />
        Ephemeral chat
      </h2>
      <form className="mb-3 flex flex-col gap-2 sm:flex-row" onSubmit={onSendMessage}>
        <input
          className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm"
          value={messageDraft}
          onChange={(e) => onMessageDraftChange(e.target.value)}
          placeholder="Message self-destructs after TTL"
        />
        <button
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500"
          type="submit"
        >
          <Send size={14} />
          Send
        </button>
      </form>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? <p className="text-sm text-slate-400">No messages yet.</p> : null}
        {messages.map((m, index) => (
          <motion.div
            key={m.messageId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.15 }}
            className="rounded-lg bg-slate-800 p-2.5 text-sm"
          >
            <span className="font-semibold">{m.displayName}: </span>
            <span>{m.message}</span>
          </motion.div>
        ))}
      </div>
    </motion.article>
  );
}
