"use client";

import { useEffect, useState } from "react";
import { Phone, Globe, MessageCircle, Clock, ExternalLink, Trash2 } from "lucide-react";
import type { CallRecord } from "@/lib/types";
import { listCalls, endCall } from "@/lib/api";
import { useRouter } from "next/navigation";

const statusColor: Record<string, string> = {
  created: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  calling: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  invite_sent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  ended: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const typeIcon: Record<string, React.ReactNode> = {
  web: <Globe className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
};

export default function ActiveCalls() {
  const router = useRouter();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = async () => {
    const data = await listCalls();
    setCalls(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCalls();
    const id = setInterval(fetchCalls, 5000);
    return () => clearInterval(id);
  }, []);

  const handleEnd = async (roomName: string) => {
    await endCall(roomName);
    setCalls((prev) => prev.filter((c) => c.room_name !== roomName));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        Loading calls...
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
        <Phone className="w-10 h-10 opacity-30" />
        <p className="text-sm">No active calls — launch one to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <div key={call.room_name} className="glass glass-hover rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 flex-shrink-0">
            {typeIcon[call.call_type]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm">{call.agent_name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[call.status] || statusColor.created}`}>
                {call.status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(call.created_at * 1000).toLocaleTimeString()}
              </span>
              {call.phone_number && <span>{call.phone_number}</span>}
              {call.whatsapp_number && <span>{call.whatsapp_number}</span>}
              <span className="font-mono truncate">{call.room_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push(`/room/${call.room_name}`)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Open call"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleEnd(call.room_name)}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="End call"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
