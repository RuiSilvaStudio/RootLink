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

const ENTITY_TYPES = [
  { value: "organization", label: "Organization" },
  { value: "partners", label: "Partner" },
  { value: "suppliers", label: "Supplier" },
];

export default function EntityRegisterPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();

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
      addToast("success", "Registration submitted — pending verification");
      router.push(`/entity/${entity.id}`);
    } catch (err: any) {
      addToast("error", err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Building className="w-5 h-5 text-primary-500" />}
        title="Register your organization"
        subtitle="Organizations, partners, and suppliers are registered here and then reviewed by platform staff before they're verified. You&apos;ll be able to upload supporting documents on the next screen."
      />

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Entity type</label>
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
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Green Valley Cooperative"
            required
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Tax/business registration ID (optional now)</label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="e.g. NIF 123456789"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">Scheme</label>
            <input
              value={taxScheme}
              onChange={(e) => setTaxScheme(e.target.value)}
              placeholder="NIF"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">
          You&apos;ll be able to upload proof documents (business registration certificate, etc.) right after
          submitting. Until a platform admin verifies this entity, you remain a regular individual account.
        </p>

        <Button type="submit" disabled={submitting} loading={submitting}>
          Submit registration
        </Button>
      </form>
    </div>
  );
}
