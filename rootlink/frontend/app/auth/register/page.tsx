"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Building, Stethoscope, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Text } from "@/components/ui/Text";

const ACCOUNT_TYPES = [
  { value: "individual", icon: User, labelKey: "auth.type_individual", descKey: "auth.type_individual_desc" },
  { value: "organization", icon: Building, labelKey: "auth.type_organization", descKey: "auth.type_organization_desc" },
  { value: "practitioner", icon: Stethoscope, labelKey: "auth.type_practitioner", descKey: "auth.type_practitioner_desc" },
];

const ENTITY_TYPES = [
  { value: "ipss", labelKey: "auth.entity_ipss" },
  { value: "cooperative", labelKey: "auth.entity_cooperative" },
  { value: "association", labelKey: "auth.entity_association" },
  { value: "cer", labelKey: "auth.entity_cer" },
  { value: "ministry", labelKey: "auth.entity_ministry" },
  { value: "regulatory", labelKey: "auth.entity_regulatory" },
  { value: "adr", labelKey: "auth.entity_adr" },
  { value: "municipality", labelKey: "auth.entity_municipality" },
  { value: "company", labelKey: "auth.entity_company" },
  { value: "other", labelKey: "auth.entity_other" },
];

export default function RegisterPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { setAuth } = useAuth();

  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Organization fields
  const [entityType, setEntityType] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [services, setServices] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  // Practitioner fields
  const [modality, setModality] = useState("");
  const [certifications, setCertifications] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t("auth.password_mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.password_length"));
      return;
    }
    setError("");
    try {
      const data: any = { email, name, password, account_type: accountType };
      if (accountType === "organization") {
        data.entity_type = entityType || undefined;
        data.registration_number = registrationNumber || undefined;
        data.services = services.split(",").map((s) => s.trim()).filter(Boolean);
        data.service_area = serviceArea || undefined;
      } else if (accountType === "practitioner") {
        data.modality = modality || undefined;
        data.certifications = certifications.split(",").map((s) => s.trim()).filter(Boolean);
      }
      const res = await api.auth.register(data);
      await setAuth(res.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 px-4">
      <Text k="auth.register_title" as="h1" className="text-3xl font-display font-bold text-stone-800 dark:text-stone-100 mb-2" />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary-500" : "bg-stone-200 dark:bg-stone-700"}`} />
        ))}
      </div>

      {error && (
        <p className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">{error}</p>
      )}

      {/* Step 1: Account type */}
      {step === 1 && (
        <div className="space-y-4">
          <Text k="auth.choose_account_type" as="p" className="text-sm text-stone-500 dark:text-stone-400 font-serif" />
          {ACCOUNT_TYPES.map((at) => {
            const Icon = at.icon;
            const isSelected = accountType === at.value;
            return (
              <button
                key={at.value}
                onClick={() => setAccountType(at.value)}
                className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-primary-500 bg-primary-50/40 dark:bg-primary-900/20 shadow-sm"
                    : "border-stone-200 dark:border-stone-700 hover:border-primary-300"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "bg-primary-600 text-white" : "bg-stone-100 text-stone-400"
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <Text k={at.labelKey} as="p" className="font-display font-semibold text-stone-800 dark:text-stone-100" />
                  <Text k={at.descKey} as="p" className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-serif" />
                </div>
                {isSelected && <Check className="w-5 h-5 text-primary-500 shrink-0 mt-1" />}
              </button>
            );
          })}
          <Text k="auth.continue" as="button" onClick={() => setStep(2)} className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 transition font-medium" />
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Common fields */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
              {accountType === "organization" ? t("auth.organization_name") : t("auth.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <Text k="auth.email" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Text k="auth.password" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <Text k="auth.confirm_password" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Organization fields */}
          {accountType === "organization" && (
            <div className="space-y-4 pt-2 border-t border-stone-200 dark:border-stone-700">
              <Text k="auth.organization_details" as="p" className="text-sm font-display font-semibold text-stone-700 dark:text-stone-300" />
              <div>
                <Text k="auth.entity_type" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">—</option>
                  {ENTITY_TYPES.map((et) => (
                    <option key={et.value} value={et.value}>{t(et.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Text k="auth.registration_number" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder={t("auth.registration_number_placeholder")}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <Text k="auth.services" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
                <input
                  type="text"
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  placeholder={t("auth.services_placeholder")}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <Text k="auth.service_area" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
                <input
                  type="text"
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  placeholder={t("auth.service_area_placeholder")}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Practitioner fields */}
          {accountType === "practitioner" && (
            <div className="space-y-4 pt-2 border-t border-stone-200 dark:border-stone-700">
              <Text k="auth.practitioner_details" as="p" className="text-sm font-display font-semibold text-stone-700 dark:text-stone-300" />
              <div>
                <Text k="auth.modality" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
                <input
                  type="text"
                  value={modality}
                  onChange={(e) => setModality(e.target.value)}
                  placeholder={t("auth.modality_placeholder")}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <Text k="auth.certifications" as="label" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1" />
                <input
                  type="text"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder={t("auth.certifications_placeholder")}
                  className="w-full px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Text k="auth.back" as="button" type="button" onClick={() => setStep(1)} className="px-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition text-sm font-medium" />
            <Text k="auth.create_account" as="button" type="submit" className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 transition font-medium" />
          </div>
        </form>
      )}

      <p className="mt-6 text-sm text-stone-500 dark:text-stone-400 text-center">
        {t("auth.has_account")}{" "}
        <Link href="/auth/login" data-rl-text="auth.sign_in_link" className="text-primary-600 hover:underline">
          {t("auth.sign_in_link")}
        </Link>
      </p>
    </div>
  );
}
