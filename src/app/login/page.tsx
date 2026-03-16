"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Phone, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        phone,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid phone number or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-emerald-50/30 to-teal-50/20 dark:from-gray-950 dark:via-emerald-950/10 dark:to-gray-950 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="card p-8 md:p-10 shadow-2xl shadow-gray-200/50 dark:shadow-black/50">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl" />
              <Image
                src="/logo.png"
                alt="Bull Logistic"
                width={72}
                height={72}
                className="rounded-2xl relative z-10"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bull Logistic
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Delivery Management System
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className="input input-icon"
                  required
                  autoFocus
                  suppressHydrationWarning
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input input-icon pr-10"
                  required
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  suppressHydrationWarning
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              >
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              suppressHydrationWarning
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
            Bull Agritech &copy; {new Date().getFullYear()}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
