"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Phone, Shield, Key, X, UserPlus } from "lucide-react";
import { createUser, resetPassword } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { cn, getInitials, formatDate } from "@/lib/utils";

const roleColors: Record<string, string> = {
  ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
  LM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  CM: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

interface UsersClientProps {
  users: any[];
}

export function UsersClient({ users }: UsersClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", phone: "", password: "", role: "CM" });
  const [resetPw, setResetPw] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser(newUser);
      setShowCreate(false);
      setNewUser({ name: "", phone: "", password: "", role: "CM" });
      router.refresh();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReset) return;
    setLoading(true);
    try {
      await resetPassword(showReset, resetPw);
      setShowReset(null);
      setResetPw("");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{users.length} users</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* User cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user: any, i: number) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</p>
              </div>
              <span className={`badge text-[10px] ${roleColors[user.role]}`}>
                <Shield className="w-3 h-3 mr-1" />{user.role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Joined {formatDate(user.createdAt)}</span>
              <button
                onClick={() => setShowReset(user.id)}
                className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1"
              >
                <Key className="w-3 h-3" /> Reset Password
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative card p-6 w-full max-w-md z-10">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">New User</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input placeholder="Full Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="input" required />
              <input placeholder="Phone Number" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="input" required />
              <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input" required />
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="input">
                <option value="CM">Center Manager</option>
                <option value="LM">Logistic Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Creating..." : "Create User"}</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReset(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative card p-6 w-full max-w-sm z-10">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Reset Password</h3>
            <form onSubmit={handleReset} className="space-y-4">
              <input placeholder="New Password" type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} className="input" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowReset(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Resetting..." : "Reset"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
