"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { PlantForm } from "@/components/admin/PlantForm";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

export default function EditPlantPage() {
  const router = useRouter();
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  const { t } = useLocale();
  const [plant, setPlant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNaN(id)) return;
    api.plants.get(id)
      .then(setPlant)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: any) => {
    setSaving(true);
    try {
      await api.plants.update(id, data);
      toast.success("Plant updated.");
      router.push("/admin/plants");
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-cream dark:bg-stone-950">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 bg-white dark:bg-stone-950 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/admin/plants" className="p-2 -ml-2 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">{t("admin.plant_edit")}</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Edit {plant?.scientific_name || "plant"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <ListSkeleton rows={8} />
          ) : loadError ? (
            <LoadError onRetry={() => {
              setLoadError(false);
              setLoading(true);
              api.plants.get(id).then(setPlant).catch(() => setLoadError(true)).finally(() => setLoading(false));
            }} />
          ) : plant ? (
            <PlantForm plant={plant} onSave={handleSave} onCancel={() => router.push("/admin/plants")} saving={saving} t={t} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
