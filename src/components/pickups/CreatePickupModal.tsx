"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Trash2, MapPin, Home, Calendar, StickyNote } from "lucide-react";
import { createMasterRequest } from "@/actions/pickups";

interface CreatePickupModalProps {
  centers: any[];
  factories: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePickupModal({ centers, factories, onClose, onSuccess }: CreatePickupModalProps) {
  const [loading, setLoading] = useState(false);
  const [commodity, setCommodity] = useState("Castor");
  const [factoryId, setFactoryId] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [children, setChildren] = useState([
    { pickupLocType: "CENTER", centerId: "", villageName: "", supervisorName: "", estWeight: 0, estBags: 0, stopSequence: 1 },
  ]);
  const [showAddSupervisor, setShowAddSupervisor] = useState<Record<number, boolean>>({});

  const addChild = () => {
    setChildren([
      ...children,
      { pickupLocType: "CENTER", centerId: "", villageName: "", supervisorName: "", estWeight: 0, estBags: 0, stopSequence: children.length + 1 },
    ]);
  };

  const removeChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index).map((c, i) => ({ ...c, stopSequence: i + 1 })));
  };

  const updateChild = (index: number, field: string, value: any) => {
    const updated = [...children];
    (updated[index] as any)[field] = value;
    // If switching from BFH to CENTER, clear villageName; vice versa clear centerId
    if (field === "pickupLocType") {
      if (value === "CENTER") updated[index].villageName = "";
    }
    setChildren(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createMasterRequest({
        commodity,
        factoryId,
        pickupDate,
        note: note || undefined,
        children: children.map((c) => ({
          ...c,
          estWeight: Number(c.estWeight),
          estBags: Number(c.estBags || 0),
          centerId: c.pickupLocType === "CENTER" ? c.centerId : undefined,
          villageName: c.pickupLocType === "BFH" ? c.villageName : undefined,
          supervisorName: c.supervisorName || undefined,
        })),
      });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred while saving the request");
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = children.reduce((s, c) => s + Number(c.estWeight || 0), 0);
  const totalBags = children.reduce((s, c) => s + Number(c.estBags || 0), 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl z-10 flex flex-col shadow-2xl"
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg flex flex-col font-bold text-gray-900 dark:text-white">
            New Pickup Request
            {pickupDate && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                📅 {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(pickupDate))} • {commodity} {factoryId && '• Factory'}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-200/50 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col relative">
          <div className="p-5 space-y-6 flex-1">
            {/* Step 1: Basic Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">1</div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Date & Info</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pickup Date *</label>
                  <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="input bg-white dark:bg-gray-800" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Commodity</label>
                  <input value={commodity} onChange={(e) => setCommodity(e.target.value)} className="input bg-white dark:bg-gray-800" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Deliver to Factory</label>
                  <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)} className="input bg-white dark:bg-gray-800">
                    <option value="">Select Factory Later...</option>
                    {factories.map((f: any) => (
                      <option key={f.id} value={f.id}>{f.factoryName} {f.location ? `— ${f.location}` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Stops */}
            <div>
              <div className="flex items-center justify-between mb-3 sticky top-16 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md z-20 py-2 -mx-5 px-5 border-y border-gray-200/50 dark:border-gray-800/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">2</div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pickup Stops</h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                  Total: {totalWeight} kg | {totalBags} Bags
                </div>
              </div>

              <div className="space-y-4">
                {children.map((child, index) => (
                  <div key={index} className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 relative">
                    {children.length > 1 && (
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Stop #{child.stopSequence}</span>
                        <button type="button" onClick={() => removeChild(index)} className="p-1.5 -m-1.5 text-red-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Row 1: Segmented Control */}
                    <div className="flex bg-gray-100 dark:bg-gray-900/50 overflow-hidden rounded-lg p-1">
                      <button 
                        type="button"
                        onClick={() => updateChild(index, "pickupLocType", "CENTER")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-all duration-200 ${child.pickupLocType === "CENTER" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"}`}
                      >
                         <Home className="w-3.5 h-3.5" /> Center
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateChild(index, "pickupLocType", "BFH")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-all duration-200 ${child.pickupLocType === "BFH" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"}`}
                      >
                         <MapPin className="w-3.5 h-3.5" /> Buy from Home
                      </button>
                    </div>

                    {/* Row 2: Location */}
                    <div className="grid grid-cols-1 gap-3">
                      <select
                        value={child.centerId}
                        onChange={(e) => updateChild(index, "centerId", e.target.value)}
                        className="input bg-gray-50 dark:bg-gray-900/50"
                        required={child.pickupLocType === "CENTER"}
                      >
                        <option value="">{child.pickupLocType === "BFH" ? "Select Center (optional)" : "Select Center *"}</option>
                        {centers.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.centerName}</option>
                        ))}
                      </select>

                      {child.pickupLocType === "BFH" && (
                        <input
                          placeholder="Village Name *"
                          value={child.villageName}
                          onChange={(e) => updateChild(index, "villageName", e.target.value)}
                          className="input bg-gray-50 dark:bg-gray-900/50"
                          required
                        />
                      )}
                    </div>

                    {/* Row 3: Metrics */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Weight</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0"
                          value={child.estWeight || ""}
                          onChange={(e) => updateChild(index, "estWeight", e.target.value)}
                          className="input bg-gray-50 dark:bg-gray-900/50 pl-14 text-right pr-8 font-semibold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          required
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-medium">kg</span>
                      </div>
                      <div className="flex-1 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-[10px] font-semibold uppercase tracking-wide">Bags</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={child.estBags || ""}
                          onChange={(e) => updateChild(index, "estBags", e.target.value)}
                          className="input bg-gray-50 dark:bg-gray-900/50 pl-12 text-right pr-3 font-semibold text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Row 4: Optional Supervisor */}
                    {!showAddSupervisor[index] && !child.supervisorName ? (
                      <button
                        type="button"
                        onClick={() => setShowAddSupervisor(prev => ({ ...prev, [index]: true }))}
                        className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1 hover:underline px-2 py-1 -ml-2 rounded-md transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/10 w-fit"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Supervisor (optional)
                      </button>
                    ) : (
                      <div className="relative">
                        <input
                          placeholder="Supervisor Name"
                          value={child.supervisorName}
                          onChange={(e) => updateChild(index, "supervisorName", e.target.value)}
                          className="input bg-gray-50 dark:bg-gray-900/50 pr-10"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateChild(index, "supervisorName", "");
                            setShowAddSupervisor(prev => ({ ...prev, [index]: false }));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <button type="button" onClick={addChild} className="btn-secondary w-full py-4 bg-transparent border-dashed border-2 hover:bg-gray-200/50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                  <Plus className="w-4 h-4" /> Add Another Stop
                </button>
              </div>
            </div>

            {/* Step 3: Note */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-xs flex items-center justify-center flex-shrink-0">3</div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Additional Notes</h3>
              </div>
              {!showNote && !note ? (
                <button
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1.5 hover:underline px-3 py-2 -ml-3 rounded-lg transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/10 w-fit"
                >
                  <Plus className="w-4 h-4" /> Add Note (optional)
                </button>
              ) : (
                <div className="relative">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any special instructions..."
                    rows={2}
                    className="input bg-white dark:bg-gray-800 pr-10"
                    style={{ resize: "none" }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNote("");
                      setShowNote(false);
                    }}
                    className="absolute right-3 top-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Spacer pushed inside the scrollable flex container body */}
          <div className="h-28"></div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 z-30 flex gap-3 pb-safe shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 text-sm font-semibold shadow-md active:scale-[0.98] transition-all">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
