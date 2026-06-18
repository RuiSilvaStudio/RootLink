"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";

export default function RegisterPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { setAuth } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const nameError = nameTouched && !name.trim() ? t("auth.name_required") : "";
  const emailError = emailTouched && (!email || !email.includes("@") || !email.includes(".")) ? t("auth.email_invalid") : "";
  const passwordError = passwordTouched && password.length < 8 ? t("auth.password_length") : "";
  const confirmError = confirmTouched && confirmPassword !== password ? t("auth.password_mismatch") : "";
  const hasErrors = !!nameError || !!emailError || !!passwordError || !!confirmError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;
    setError("");
    try {
      const res = await api.auth.register({ email, name, password });
      await setAuth(res.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <h1 className="text-3xl font-bold text-stone-800 font-serif mb-6">
        {t("auth.register_title")}
      </h1>
      {error && (
        <p className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            {t("auth.name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameTouched(true); }}
            onBlur={() => setNameTouched(true)}
            required
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            {t("auth.email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
            onBlur={() => setEmailTouched(true)}
            required
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            {t("auth.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true); }}
            onBlur={() => setPasswordTouched(true)}
            required
            minLength={8}
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            {t("auth.confirm_password")}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setConfirmTouched(true); }}
            onBlur={() => setConfirmTouched(true)}
            required
            className="w-full px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {confirmError && <p className="text-xs text-red-500 mt-1">{confirmError}</p>}
        </div>
        <button
          type="submit"
          disabled={hasErrors}
          className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50"
        >
          {t("auth.create_account")}
        </button>
      </form>
      <p className="mt-4 text-sm text-stone-500 text-center">
        {t("auth.has_account")}{" "}
        <a href="/auth/login" className="text-primary-600 hover:underline">
          {t("auth.sign_in_link")}
        </a>
      </p>
    </div>
  );
}
