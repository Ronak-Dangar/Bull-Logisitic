"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Factory, MapPin, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

// Inline server action calls (since we need admin-only factory CRUD)
async function createFactory(data: { factoryName: string; location: string }) {
  const res = await fetch("/api/admin/factories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create factory");
  return res.json();
}

async function deleteFactory(id: string) {
  const res = await fetch(`/api/admin/factories?id=${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete factory");
}

export function FactoriesClient({ factories }: { factories: any[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newFactory, setNewFactory] = useState({ factoryName: "", location: "" });
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createFactory(newFactory);
      setShowCreate(false);
      setNewFactory({ factoryName: "", location: "" });
      router.refresh();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this factory?")) return;
    await deleteFactory(id);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{factories.length} factories</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Factory
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {factories.map((factory: any, i: number) => (
          <motion.div
            key={factory.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                  <Factory className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{factory.factoryName}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(factory.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {factory.location && (
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{factory.location}
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
              <h3 className="font-bold text-gray-900 dark:text-white">New Factory</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input placeholder="Factory Name" value={newFactory.factoryName} onChange={(e) => setNewFactory({ ...newFactory, factoryName: e.target.value })} className="input" required />
              <input placeholder="Location" value={newFactory.location} onChange={(e) => setNewFactory({ ...newFactory, location: e.target.value })} className="input" />
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating..." : "Create Factory"}</button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
