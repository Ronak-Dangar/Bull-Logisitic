"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Link, X, Plus, User2, Building2 } from "lucide-react";
import { addMapping, removeMapping } from "@/actions/admin";
import { useRouter } from "next/navigation";

interface MappingClientProps {
  mappings: any[];
  users: any[];
  centers: any[];
}

export function MappingClient({ mappings, users, centers }: MappingClientProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [loading, setLoading] = useState(false);

  const cmUsers = users.filter((u: any) => u.role === "CM");

  const handleAdd = async () => {
    if (!selectedUser || !selectedCenter) return;
    setLoading(true);
    try {
      await addMapping(selectedUser, selectedCenter);
      setShowAdd(false);
      setSelectedUser("");
      setSelectedCenter("");
      router.refresh();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRemove = async (id: string) => {
    await removeMapping(id);
    router.refresh();
  };

  // Group by user
  const grouped: Record<string, { user: any; centers: { mappingId: string; center: any }[] }> = {};
  mappings.forEach((m: any) => {
    if (!grouped[m.user.id]) {
      grouped[m.user.id] = { user: m.user, centers: [] };
    }
    grouped[m.user.id].centers.push({ mappingId: m.id, center: m.center });
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{mappings.length} mappings</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Mapping
        </button>
      </div>

      <div className="space-y-4">
        {Object.values(grouped).map((group: any, i: number) => (
          <motion.div
            key={group.user.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <User2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{group.user.name}</p>
                <p className="text-xs text-gray-500">{group.user.phone} • {group.user.role}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.centers.map((c: any) => (
                <span key={c.mappingId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  {c.center.centerName}
                  <button onClick={() => handleRemove(c.mappingId)} className="ml-1 hover:text-red-500 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative card p-6 w-full max-w-md z-10">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Add Mapping</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="input">
                <option value="">Select User (CM)</option>
                {cmUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>)}
              </select>
              <select value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)} className="input">
                <option value="">Select Center</option>
                {centers.map((c: any) => <option key={c.id} value={c.id}>{c.centerName}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAdd} disabled={loading} className="btn-primary flex-1">{loading ? "Adding..." : "Add Mapping"}</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
