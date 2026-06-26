"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newUserId = searchParams.get("user");

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(!!newUserId);
  const [recipient, setRecipient] = useState<any>(null);
  const [messageBody, setMessageBody] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  useEffect(() => {
    if (!token) return;
    api.messages.conversations().then(setConversations).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (newUserId) {
      api.users.get(Number(newUserId)).then(setRecipient).catch(() => {});
    }
  }, [newUserId]);

  const [activeConv, setActiveConv] = useState<number | null>(null);
  const [activeMessages, setActiveMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [activeOtherUserId, setActiveOtherUserId] = useState<number | null>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const { t } = useLocale();
  useEffect(() => {
    if (token) api.auth.me().then(setCurrentUser).catch(() => {});
  }, [token]);

  const openConv = async (convId: number) => {
    setActiveConv(convId);
    const msgs = await api.messages.getMessages(convId);
    setActiveMessages(msgs);
    const conv = conversations.find((c) => c.id === convId);
    if (conv?.other_user) setActiveOtherUserId(conv.other_user.id);
  };

  const handleSendNew = async () => {
    if (!messageBody.trim() || !newUserId) return;
    const conv = await api.messages.send(Number(newUserId), messageBody);
    setConversations([conv, ...conversations]);
    setMessageBody("");
    setShowNew(false);
    setRecipient(null);
    router.push(`/messages/${conv.id}`);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !activeConv || !activeOtherUserId) return;
    await api.messages.send(activeOtherUserId, replyText);
    const msgs = await api.messages.getMessages(activeConv);
    setActiveMessages(msgs);
    setReplyText("");
  };

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <MessageCircle className="w-16 h-16 mx-auto mb-4 text-stone-300" />
        <p className="text-stone-500">{t("messages.sign_in")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-8">{t("messages.title")}</h1>

      {showNew && recipient && (
        <div className="bg-white p-4 rounded-xl border border-stone-200 mb-6">
          <p className="text-sm text-stone-500 mb-2">{t("messages.new_message_to", { name: recipient.name })}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder={t("messages.write_message")}
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm"
            />
            <button onClick={handleSendNew} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">{t("messages.loading")}</p>
      ) : conversations.length === 0 ? (
        <div className="text-center py-20 text-stone-00 dark:text-stone-500">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t("messages.no_conversations")}</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConv(conv.id)}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  activeConv === conv.id
                    ? "bg-primary-50 border-primary-200"
                    : "bg-white border-stone-200 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center text-primary-700 text-xs font-medium shrink-0">
                    {conv.other_user?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{conv.other_user?.name || "Unknown"}</p>
                    {conv.last_message && <p className="text-xs text-stone-00 dark:text-stone-500 truncate">{conv.last_message}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {activeConv ? (
              <div className="bg-white rounded-xl border border-stone-200 min-h-[400px] flex flex-col">
                <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[500px]">
                  {activeMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === 0 ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] p-3 rounded-xl text-sm ${
                        msg.sender_id === 0
                          ? "bg-primary-600 text-white"
                          : "bg-stone-100 text-stone-700"
                      }`}>
                        {msg.body}
                        <p className="text-xs mt-1 opacity-70">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-stone-200 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("messages.type_message")}
                    className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm"
                  />
                  <button onClick={handleReply} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 min-h-[400px] flex items-center justify-center text-stone-00 dark:text-stone-500">
                <p>{t("messages.select_conversation")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<div className="text-center py-20 text-stone-500">{t("messages.loading")}</div>}>
      <MessagesContent />
    </Suspense>
  );
}
