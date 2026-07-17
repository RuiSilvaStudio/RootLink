"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Text } from "@/components/ui/Text";

// Dev-mode self-service password reset (product-approved): no email
// infrastructure exists yet, so POST /api/auth/password/reset/request
// returns the raw reset code directly in the response and we show it
// on-screen, clearly labelled as such. All state is kept client-side —
// deliberately no query params (docs/LESSONS.md #1: useSearchParams()
// in a statically-prerendered page breaks the production build).
type Step = "request" | "reset" | "done";

const inputClasses =
  "w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500";

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [token, setToken] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const emailError =
    emailTouched && (!email || !email.includes("@") || !email.includes("."))
      ? t("auth.email_invalid")
      : "";

  const friendlyError = (err: any, fallback: string) => {
    if (err?.status === 429) return t("auth.rate_limited");
    if (err?.status === 400) return fallback;
    // 422 = pydantic validation (e.g. reserved/special-use email domains) —
    // never surface raw validator text like "The part after the @-sign is
    // a special-use or reserved name" to end users.
    if (err?.status === 422) return t("auth.email_invalid");
    return err?.message || fallback;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await api.auth.requestPasswordReset(email);
      if (res.token) {
        setIssuedToken(res.token);
        setToken(res.token);
        setStep("reset");
      } else {
        // Dev-mode: no email delivery exists, so a missing token means no
        // account matched — say so instead of silently going nowhere.
        setError(t("auth.forgot_no_account"));
      }
    } catch (err: any) {
      setError(friendlyError(err, t("auth.forgot_no_account")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError(t("auth.reset_token_required"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("auth.password_length"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.password_mismatch"));
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.auth.confirmPasswordReset({ token: token.trim(), new_password: newPassword });
      setStep("done");
    } catch (err: any) {
      setError(friendlyError(err, t("auth.reset_token_invalid")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <Text k="auth.forgot_title" as="h1" className="text-3xl font-display font-bold text-stone-800 dark:text-stone-100 mb-6" />

      {error && (
        <p className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </p>
      )}

      {step === "request" && (
        <>
          <Text k="auth.forgot_intro" as="p" className="text-sm text-stone-500 dark:text-stone-400 font-serif mb-4" />
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <Text k="auth.email" as="label" htmlFor="forgot-email" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailTouched(true); }}
                onBlur={() => setEmailTouched(true)}
                required
                className={inputClasses}
              />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>
            <Text k="auth.forgot_submit" as="button" type="submit" disabled={!!emailError || submitting} className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50" />
          </form>
        </>
      )}

      {step === "reset" && (
        <>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 font-serif">
              <Text k="auth.forgot_dev_note" as="span" />
            </p>
            {issuedToken && (
              <>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mt-3 mb-1">
                  <Text k="auth.forgot_code_label" as="span" />
                </p>
                <p className="font-mono text-xs text-stone-800 dark:text-stone-100 bg-white dark:bg-stone-800 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2 break-all select-all">
                  {issuedToken}
                </p>
              </>
            )}
          </div>
          <form onSubmit={handleConfirm} className="space-y-4">
            <div>
              <Text k="auth.reset_token" as="label" htmlFor="reset-token" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
              <input
                id="reset-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                autoComplete="off"
                className={`${inputClasses} font-mono text-sm`}
              />
            </div>
            <div>
              <Text k="auth.new_password" as="label" htmlFor="reset-new-password" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
              <input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClasses}
              />
            </div>
            <div>
              <Text k="auth.confirm_password" as="label" htmlFor="reset-confirm-password" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className={inputClasses}
              />
            </div>
            <Text k="auth.reset_submit" as="button" type="submit" disabled={submitting} className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50" />
          </form>
        </>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <Text k="auth.reset_success" as="p" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm" />
          <Text k="auth.back_to_login" as="a" href="/auth/login" className="block w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition font-medium text-center" />
        </div>
      )}

      {step !== "done" && (
        <p className="mt-4 text-sm text-stone-500 text-center">
          <Text k="auth.back_to_login" as="a" href="/auth/login" className="text-primary-600 hover:underline" />
        </p>
      )}
    </div>
  );
}
