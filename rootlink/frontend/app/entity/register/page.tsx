"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function EntityRegisterPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const ENTITY_TYPES = [
    { value: "organization", label: t("entity_register.type_organization") },
    { value: "partners", label: t("entity_register.type_partner") },
    { value: "suppliers", label: t("entity_register.type_supplier") },
  ];

  const [entityType, setEntityType] = useState("organization");
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxScheme, setTaxScheme] = useState("NIF");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const entity = await api.entities.register({
        entity_type: entityType,
        name: name.trim(),
        tax_registration_id: taxId || undefined,
        tax_registration_scheme: taxId ? taxScheme : undefined,
      });
      addToast("success", t("entity_register.success"));
      router.push(`/entity/${entity.id}`);
    } catch (err: any) {
      addToast("error", err.message || t("entity_register.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Building className="w-5 h-5 text-primary-500" />}
        title={t("entity_register.title")}
        subtitle={t("entity_register.subtitle")}
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{t("entity_register.entity_type_label")}</label>
          <div className="flex gap-2 flex-wrap">
            {ENTITY_TYPES.map((et) => (
              <button
                type="button"
                key={et.value}
                onClick={() => setEntityType(et.value)}
                className={`px-4 py-2 text-sm rounded-xl border transition ${
                  entityType === et.value
                    ? "bg-primary-600 text-white border-primary-600"
                    : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-primary-300"
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{t("entity_register.name_label")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("entity_register.name_placeholder")}
            required
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{t("entity_register.tax_id_label")}</label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder={t("entity_register.tax_id_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{t("entity_register.scheme_label")}</label>
            <input
              value={taxScheme}
              onChange={(e) => setTaxScheme(e.target.value)}
              placeholder="NIF"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">
          {t("entity_register.footer_note")}
        </p>

        <Button type="submit" disabled={submitting} loading={submitting}>
          {t("entity_register.submit")}
        </Button>
      </form>
    </div>
  );
}
