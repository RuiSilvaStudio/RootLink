"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Button, Textarea } from "@/components/ui";
import { Send } from "lucide-react";

export default function AdminBroadcast() {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await api.admin.broadcast(message);
      setMessage("");
      toast.success(`Notification sent to ${res.sent_to} recipient${res.sent_to === 1 ? "" : "s"}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
          Notifications
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Send platform-wide broadcast notifications
        </p>
      </div>

      <div className="p-4 lg:p-6">
        <div className="mb-6">
          <Badge variant="sage" className="mb-3">{t("admin.broadcast")}</Badge>
        </div>

        <div className="max-w-lg">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-display font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">
                {t("admin.broadcast_message_label")}
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("admin.broadcast_placeholder")}
                rows={4}
                className="resize-none"
              />
            </div>
            <Button type="submit" disabled={sending || !message.trim()}>
              <Send className="w-4 h-4" />
              {sending ? t("admin.sending") : t("admin.send_to_all")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
