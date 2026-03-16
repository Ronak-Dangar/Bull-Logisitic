"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Truck, Info } from "lucide-react";
import { createDelivery } from "@/actions/deliveries";
import { cn } from "@/lib/utils";

interface CreateDeliveryModalProps {
  masterReqId: string;
  initialFactoryId?: string | null;
  factories: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateDeliveryModal({ masterReqId, initialFactoryId, factories, onClose, onSuccess }: CreateDeliveryModalProps) {
  const [loading, setLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [form, setForm] = useState({
    factoryId: initialFactoryId || "",
    vehicleNumber: "",
    driverName: "",
    driverContact: "",
    transporterName: "",
    transpContact: "",
    expDeliveryDt: "",
    scheduledPickupTime: "",
    ratePerTon: "",
    advancePaid: "",
    miscAmount: "",
    invoiceNo: "",
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Vehicle number validation
    const vn = form.vehicleNumber.toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vn)) {
      setVehicleError("Invalid format. Use: AA00AA0000 (e.g. GJ01AB1234)");
      return;
    }
    setVehicleError(null);

    setLoading(true);
    try {
      await createDelivery({
        masterReqId,
        factoryId: form.factoryId,
        vehicleNumber: form.vehicleNumber,
        driverName: form.driverName || undefined,
        driverContact: form.driverContact || undefined,
        transporterName: form.transporterName || undefined,
        transpContact: form.transpContact || undefined,
        expDeliveryDt: form.expDeliveryDt || undefined,
        scheduledPickupTime: form.scheduledPickupTime || undefined,
        ratePerTon: form.ratePerTon ? Number(form.ratePerTon) : undefined,
        advancePaid: form.advancePaid ? Number(form.advancePaid) : undefined,
        miscAmount: form.miscAmount ? Number(form.miscAmount) : undefined,
        invoiceNo: form.invoiceNo || undefined,
      });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] flex flex-col bg-slate-50 dark:bg-gray-900 sm:rounded-2xl shadow-xl z-10 overflow-hidden"
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 sm:p-6 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            Create Delivery
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 space-y-6">
          <form id="create-delivery-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Group 1: Logistics & Vehicle Details */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Logistics & Vehicle Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery Factory *</label>
                <select value={form.factoryId} onChange={(e) => update("factoryId", e.target.value)} className="input w-full" required>
                  <option value="">Select Factory</option>
                  {factories.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.factoryName} — {f.location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle Number *</label>
                <input
                  value={form.vehicleNumber}
                  onChange={(e) => { update("vehicleNumber", e.target.value); setVehicleError(null); }}
                  placeholder="GJ01AB1234"
                  className={cn("input w-full", vehicleError && "border-red-400 focus:border-red-500 focus:ring-red-500")}
                  required
                />
                {vehicleError && <span className="text-[10px] text-red-500 mt-1 block">{vehicleError}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Driver Name</label>
                <input value={form.driverName} onChange={(e) => update("driverName", e.target.value)} className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Driver Contact</label>
                <input value={form.driverContact} onChange={(e) => update("driverContact", e.target.value)} placeholder="Phone number" className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transporter</label>
                <input value={form.transporterName} onChange={(e) => update("transporterName", e.target.value)} className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Transporter Contact</label>
                <input value={form.transpContact} onChange={(e) => update("transpContact", e.target.value)} className="input w-full" />
              </div>
            </div>

            {/* Group 2: Cargo & Documentation */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Cargo & Documentation</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scheduled Pickup Time</label>
                <input type="datetime-local" value={form.scheduledPickupTime} onChange={(e) => update("scheduledPickupTime", e.target.value)} className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Delivery</label>
                <input type="datetime-local" value={form.expDeliveryDt} onChange={(e) => update("expDeliveryDt", e.target.value)} className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice Number</label>
                <input value={form.invoiceNo} onChange={(e) => update("invoiceNo", e.target.value)} className="input w-full" />
              </div>
            </div>

            {/* Group 3: Financials */}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Financials</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate per Ton (₹)</label>
                <input type="number" step="0.01" value={form.ratePerTon} onChange={(e) => update("ratePerTon", e.target.value)} className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Advance Paid (₹)</label>
                <input type="number" step="0.01" value={form.advancePaid} onChange={(e) => update("advancePaid", e.target.value)} className="input w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Misc Amount (₹)</label>
                <input type="number" step="0.01" value={form.miscAmount} onChange={(e) => update("miscAmount", e.target.value)} className="input w-full" />
              </div>
            </div>

          </form>

          {/* Helper Text */}
          <div className="flex items-start gap-2 text-slate-500 dark:text-gray-400 mt-6 pt-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Creating a delivery will mark the pickup request as <strong className="font-semibold text-slate-700 dark:text-gray-300">Processed</strong>.
            </p>
          </div>
        </div>

        {/* Sticky Bottom Action Area */}
        <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shrink-0 flex flex-col gap-3 pb-8 sm:pb-6">
          <button type="submit" form="create-delivery-form" disabled={loading} className="btn-primary w-full py-4 rounded-xl text-base font-semibold shadow-sm">
            {loading ? (
              <div className="mx-auto w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Create Delivery"
            )}
          </button>
          <button type="button" onClick={onClose} className="w-full py-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
