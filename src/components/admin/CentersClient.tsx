"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Building2, MapPin, Trash2, X } from "lucide-react";
import { createCenter, deleteCenter } from "@/actions/admin";
import { useRouter } from "next/navigation";

export function CentersClient({ centers }: { centers: any[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newCenter, setNewCenter] = useState({ centerName: "", locationType: "CENTER", address: "" });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createCenter(newCenter);
      setShowCreate(false);
      setNewCenter({ centerName: "", locationType: "CENTER", address: "" });
      router.refresh();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this center?")) return;
    await deleteCenter(id);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{centers.length} centers</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Center
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {centers.map((center: any, i: number) => (
          <motion.div
            key={center.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{center.centerName}</p>
                  <span className="badge text-[10px] bg-gray-500/20 text-gray-400 border-gray-500/30 mt-1">{center.locationType}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(center.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {center.address && (
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{center.address}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative card p-6 w-full max-w-md z-10">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">New Center</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input placeholder="Center Name" value={newCenter.centerName} onChange={(e) => setNewCenter({ ...newCenter, centerName: e.target.value })} className="input" required />
              <select value={newCenter.locationType} onChange={(e) => setNewCenter({ ...newCenter, locationType: e.target.value })} className="input">
                <option value="CENTER">Center</option>
                <option value="VILLAGE">Village</option>
              </select>
              <input placeholder="Address" value={newCenter.address} onChange={(e) => setNewCenter({ ...newCenter, address: e.target.value })} className="input" />
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating..." : "Create Center"}</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
