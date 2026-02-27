"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquare, Send, Package, ArrowLeft } from "lucide-react";
import { getMessages, sendMessage } from "@/actions/messages";
import { cn, formatDateTime, getStatusColor, getInitials } from "@/lib/utils";

export function MessagesClient({ requests }: { requests: any[] }) {
  const searchParams = useSearchParams();
  const reqParam = searchParams.get("req");

  const [selectedReq, setSelectedReq] = useState<string | null>(reqParam);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedRequest = requests.find((r: any) => r.id === selectedReq);

  useEffect(() => {
    if (reqParam && requests.find((r: any) => r.id === reqParam)) {
      setSelectedReq(reqParam);
    }
  }, [reqParam, requests]);

  useEffect(() => {
    if (selectedReq) {
      getMessages(selectedReq).then((msgs) => setMessages(JSON.parse(JSON.stringify(msgs))));
    }
  }, [selectedReq]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedReq) return;
    setLoading(true);
    try {
      const msg = await sendMessage(selectedReq, newMsg.trim());
      setMessages((prev) => [...prev, JSON.parse(JSON.stringify(msg))]);
      setNewMsg("");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-130px)]">
      {/* Request list */}
      <div className={cn(
        "w-full md:w-80 flex-shrink-0 card overflow-y-auto",
        selectedReq && "hidden md:block"
      )}>
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Requests</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {requests.map((req: any) => (
            <button
              key={req.id}
              onClick={() => setSelectedReq(req.id)}
              className={cn(
                "w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                selectedReq === req.id && "bg-emerald-50 dark:bg-emerald-900/10"
              )}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{req.cm?.name}</span>
                <span className={`badge text-[8px] ml-auto ${getStatusColor(req.status)}`}>{req.status.replace(/_/g, " ")}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">{req.commodity} • {req.deliveryLocation}</span>
                {req._count?.messages > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">{req._count.messages}</span>
                )}
              </div>
            </button>
          ))}
          {requests.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">No requests</div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={cn(
        "flex-1 card flex flex-col",
        !selectedReq && "hidden md:flex"
      )}>
        {selectedReq && selectedRequest ? (
          <>
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <button onClick={() => setSelectedReq(null)} className="md:hidden p-1">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{selectedRequest.cm?.name} — {selectedRequest.commodity}</p>
                <p className="text-xs text-gray-500">{selectedRequest.deliveryLocation}</p>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg: any) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {getInitials(msg.sender?.name || "U")}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{msg.sender?.name}</span>
                      <span className="text-[10px] text-gray-400">{msg.sender?.role} • {formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{msg.messageBody}</p>
                  </div>
                </motion.div>
              ))}
              {messages.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-12">No messages yet. Start the conversation!</div>
              )}
            </div>
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>Select a request to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
