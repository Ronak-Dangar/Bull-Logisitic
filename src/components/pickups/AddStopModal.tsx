"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { addChildPickup } from "@/actions/pickups";

interface AddStopModalProps {
  masterReqId: string;
  centers: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStopModal({ masterReqId, centers, onClose, onSuccess }: AddStopModalProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"CENTER" | "BFH">("CENTER");
  const [centerId, setCenterId] = useState("");
  const [villageName, setVillageName] = useState("");
  const [estWeight, setEstWeight] = useState("");
  const [estBags, setEstBags] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addChildPickup({
        masterReqId,
        pickupLocType: type,
        centerId: centerId || undefined,
        villageName: type === "BFH" ? villageName : undefined,
        estWeight: Number(estWeight),
        estBags: Number(estBags || 0),
      });
      onSuccess();
    } catch (err: any) {
      alert("Failed to add stop: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Stop</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Type *</label>
               <select value={type} onChange={(e) => setType(e.target.value as any)} className="input" required>
                 <option value="CENTER">Collection Center</option>
                 <option value="BFH">Buy From Home (Village)</option>
               </select>
            </div>
            
            {/* Center dropdown — required for CENTER, optional for BFH */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Center {type === "CENTER" ? "*" : "(optional)"}
              </label>
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="input" required={type === "CENTER"}>
                <option value="">Select Center...</option>
                {centers.map(c => (
                  <option key={c.id} value={c.id}>{c.centerName} ({c.village})</option>
                ))}
              </select>
            </div>

            {/* Village Name — BFH only */}
            {type === "BFH" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Village Name *</label>
                <input value={villageName} onChange={(e) => setVillageName(e.target.value)} className="input" placeholder="Enter village name..." required />
              </div>
            )}
            
            <div className="flex gap-2">
              <div className="flex-1">
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Weight (kg) *</label>
                 <input type="number" step="0.1" value={estWeight} onChange={(e) => setEstWeight(e.target.value)} className="input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="e.g. 500" required />
              </div>
              <div className="flex-1">
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Est. Bags *</label>
                 <input type="number" value={estBags} onChange={(e) => { setEstBags(e.target.value); const b = Number(e.target.value) || 0; if (b > 0) setEstWeight((b * 74.5).toFixed(1)); }} className="input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="e.g. 10" required />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              <Plus className="w-4 h-4" />
              {loading ? "Adding..." : "Add Stop"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
