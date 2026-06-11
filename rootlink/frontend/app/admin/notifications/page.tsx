"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

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
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t("admin.broadcast_title")}</h1>

      <div className="max-w-lg">
        <p className="text-sm text-stone-500 mb-4">
          {t("admin.broadcast_desc")}
        </p>

        <form onSubmit={handleSend} className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("admin.broadcast_placeholder")}
            rows={4}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {sending ? t("admin.sending") : t("admin.send_to_all")}
          </button>
        </form>

        {result && (
          <div className="mt-4 bg-green-50 text-green-700 rounded-lg p-3 text-sm">
            {t("admin.broadcast_sent", { count: result.sent_to })}
          </div>
        )}
      </div>
    </div>
  );
}
