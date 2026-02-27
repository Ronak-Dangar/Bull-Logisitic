"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X } from "lucide-react";
import { getMessages, sendMessage } from "@/actions/messages";
import { formatDateTime, getInitials } from "@/lib/utils";

interface ChatPopupProps {
  masterReqId: string;
  onClose: () => void;
}

export function ChatPopup({ masterReqId, onClose }: ChatPopupProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingMsgs(true);
    getMessages(masterReqId)
      .then((msgs) => setMessages(JSON.parse(JSON.stringify(msgs))))
      .finally(() => setLoadingMsgs(false));
  }, [masterReqId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    setLoading(true);
    try {
      const msg = await sendMessage(masterReqId, newMsg.trim());
      setMessages((prev) => [...prev, JSON.parse(JSON.stringify(msg))]);
      setNewMsg("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full sm:w-[420px] h-[85dvh] sm:h-[70vh] sm:max-h-[600px] bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Messages</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-12">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg: any) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {getInitials(msg.sender?.name || "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{msg.sender?.name}</span>
                    <span className="text-[10px] text-gray-400">{msg.sender?.role} • {formatDateTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 break-words">{msg.messageBody}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-2">
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              className="input flex-1"
            />
            <button onClick={handleSend} disabled={loading || !newMsg.trim()} className="btn-primary px-3">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
