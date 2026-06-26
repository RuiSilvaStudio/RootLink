"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Send } from "lucide-react";

export default function AdminBroadcast() {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent_to: number } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await api.admin.broadcast(message);
      setResult(res);
      setMessage("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.broadcast")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.broadcast_title")}
        </h1>
        <p className="text-stone-500 text-sm mt-2 font-serif max-w-lg">
          {t("admin.broadcast_desc")}
        </p>
      </div>

      <div className="max-w-lg">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">
              {t("admin.broadcast_message_label")}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("admin.broadcast_placeholder")}
              rows={4}
              className="w-full border border-stone-200/60 rounded-xl px-4 py-3 text-sm resize-none bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 bg-primary-600 text-cream px-5 py-2.5 rounded-xl text-sm font-display font-medium hover:bg-primary-700 disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4" />
            {sending ? t("admin.sending") : t("admin.send_to_all")}
          </button>
        </form>

        {result && (
          <div className="mt-4 bg-emerald-100/60 text-emerald-700 border border-emerald-200/40 rounded-xl p-4 text-sm font-serif">
            {t("admin.broadcast_sent", { count: result.sent_to })}
          </div>
        )}
      </div>
    </div>
  );
}
