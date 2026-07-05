"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailError = emailTouched && (!email || !email.includes("@") || !email.includes(".")) ? t("auth.email_invalid") : "";
  const passwordError = passwordTouched && !password ? t("auth.password_required") : "";
  const hasErrors = !!emailError || !!passwordError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    setError("");
    try {
      const res = await api.auth.login({ email, password });
      await setAuth(res.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-6">
        {t("auth.sign_in_title")}
      </h1>
      {error && (
        <p className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            {t("auth.email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
            onBlur={() => setEmailTouched(true)}
            required
            className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            {t("auth.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true); }}
            onBlur={() => setPasswordTouched(true)}
            required
            className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
          <p className="mt-1 text-right">
            <a href="/auth/forgot-password" className="text-sm text-primary-600 hover:underline">
              {t("auth.forgot_password")}
            </a>
          </p>
        </div>
        <button
          type="submit"
          disabled={hasErrors}
          className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
        >
          {t("auth.sign_in")}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone-500 text-center">
        {t("auth.no_account")}{" "}
        <a href="/auth/register" className="text-primary-600 hover:underline">
          {t("auth.register")}
        </a>
      </p>
    </div>
  );
}
