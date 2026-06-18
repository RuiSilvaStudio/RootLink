"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");

  useEffect(() => {
    const convId = Number(params.id);
    if (!convId) return;

    api.messages.conversations().then(async (convs) => {
      const conv = convs.find((c: any) => c.id === convId);
      setConversation(conv);
      const msgs = await api.messages.getMessages(convId);
      setMessages(msgs);
    }).finally(() => setLoading(false));
  }, [params.id]);

  const handleSend = async () => {
    if (!body.trim()) return;
    const otherId = conversation?.other_user?.id;
    if (!otherId) return;
    await api.messages.send(otherId, body);
    const msgs = await api.messages.getMessages(Number(params.id));
    setMessages(msgs);
    setBody("");
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
      <div className="h-8 bg-stone-200 rounded w-64 animate-pulse" />
      <div className="h-64 bg-stone-200 rounded-xl animate-pulse" />
    </div>
  );

  const other = conversation?.other_user;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: "Messages", href: "/messages" },
        { label: conversation?.other_user?.name || "Conversation" }
      ]} />
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
          {other?.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-800">{other?.name || "Conversation"}</h1>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 min-h-[500px] flex flex-col">
        <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[600px]">
          {messages.length === 0 ? (
            <p className="text-stone-400 text-center py-10">No messages yet. Say hello!</p>
          ) : (
            messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.sender_id === other?.id ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[70%] p-3 rounded-xl text-sm ${
                  msg.sender_id === other?.id
                    ? "bg-stone-100 text-stone-700"
                    : "bg-primary-600 text-white"
                }`}>
                  {msg.body}
                  <p className="text-xs mt-1 opacity-70">
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-stone-200 flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={handleSend} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
