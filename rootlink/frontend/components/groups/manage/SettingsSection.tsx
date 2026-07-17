"use client";

/**
 * Manage → Settings: basic info, images, categories, code of conduct,
 * section visibility and open-join — everything the wizard collects is
 * editable here afterwards (self-sufficiency rubric §6).
 */

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Group } from "@/lib/groups-types";
import { parseCategories, parseConfig } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { Card } from "@/components/ui/Card";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { safeImageUrl } from "@/lib/image-url";

const VISIBILITY_SECTIONS = ["announcements", "contacts", "calendar", "members", "chats", "documents", "gallery"] as const;

const CATEGORIES = [
  { family: "Agricultura", items: ["Permacultura", "Hortas urbanas", "Compostagem", "Sementes"] },
  { family: "Saúde e bem-estar", items: ["Bem-estar físico", "Saúde mental", "Nutrição", "Movimento e corpo"] },
  { family: "Cultura e artes", items: ["Música", "Teatro", "Dança", "Pintura", "Escrita"] },
  { family: "Desporto", items: ["Futebol", "Basquetebol", "Natação", "Atletismo", "Ciclismo"] },
  { family: "Ação social", items: ["Apoio a idosos", "Infância e juventude", "Sem-abrigo", "Integração"] },
  { family: "Ambiente", items: ["Conservação", "Reciclagem", "Energia", "Biodiversidade"] },
  { family: "Educação", items: ["Alfabetização", "STEM", "Línguas", "Formação profissional"] },
  { family: "Comunidade", items: ["Vizinhança", "Eventos locais", "Coletivos", "Mutirão"] },
];

export function SettingsSection({ group, onSaved }: { group: Group; onSaved: () => Promise<void> }) {
  const { t } = useLocale();
  const { addToast } = useToast();

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [descriptionLong, setDescriptionLong] = useState(group.description_long ?? "");
  const [conduct, setConduct] = useState(group.conduct ?? "");
  const [location, setLocation] = useState(group.location ?? "");
  const [cover, setCover] = useState(group.image_url ?? "");
  const [logo, setLogo] = useState(group.logo_url ?? "");
  const [categories, setCategories] = useState<string[]>(parseCategories(group.categories));
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const stored = parseConfig(group.visibility_config);
    const defaults: Record<string, boolean> = { announcements: false, contacts: true, calendar: true, members: false, chats: false, documents: true, gallery: true };
    return { ...defaults, ...stored };
  });
  const [openJoin, setOpenJoin] = useState(group.is_open);
  const [saving, setSaving] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<"cover" | "logo" | null>(null);

  const dirty = useMemo(() => {
    return (
      name !== group.name ||
      description !== (group.description ?? "") ||
      descriptionLong !== (group.description_long ?? "") ||
      conduct !== (group.conduct ?? "") ||
      location !== (group.location ?? "") ||
      cover !== (group.image_url ?? "") ||
      logo !== (group.logo_url ?? "") ||
      JSON.stringify(categories) !== JSON.stringify(parseCategories(group.categories)) ||
      openJoin !== group.is_open ||
      JSON.stringify(visibility) !== JSON.stringify({ announcements: false, contacts: true, calendar: true, members: false, chats: false, documents: true, gallery: true, ...parseConfig(group.visibility_config) })
    );
  }, [name, description, descriptionLong, conduct, location, cover, logo, categories, openJoin, visibility, group]);

  useDirtyGuard(dirty && !saving, { message: t("groups.wizard.dirty_message") });

  const nameError = name.trim().length < 2 ? t("groups.wizard.name_error") : undefined;

  const save = async () => {
    if (nameError) return;
    setSaving(true);
    try {
      await api.groups.update(group.id, {
        name: name.trim(),
        description: description || null,
        description_long: descriptionLong || null,
        conduct: conduct || null,
        location: location || null,
        image_url: cover || null,
        logo_url: logo || null,
        categories: categories.length > 0 ? JSON.stringify(categories) : null,
        visibility_config: JSON.stringify(visibility),
        is_open: openJoin,
      } as Partial<Group>);
      await onSaved();
      addToast("success", t("groups.manage.saved_toast"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <Card variant="plain" className="p-6 space-y-4">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.manage.basic_info")}</h2>
        <Input label={t("groups.manage.name_label")} value={name} error={nameError} maxLength={255} onChange={e => setName(e.target.value)} />
        <Textarea label={t("groups.manage.description_label")} value={description} maxLength={2000} rows={2} onChange={e => setDescription(e.target.value)} />
        <Textarea label={t("groups.manage.description_long_label")} value={descriptionLong} maxLength={20000} rows={5} onChange={e => setDescriptionLong(e.target.value)} />
        <Input label={t("groups.manage.location_label")} value={location} maxLength={255} onChange={e => setLocation(e.target.value)} />

        {/* Cover + logo */}
        <div className="grid sm:grid-cols-2 gap-4">
          {([["cover", t("groups.manage.cover_label"), cover, setCover], ["logo", t("groups.manage.logo_label"), logo, setLogo]] as const).map(([key, label, value, setter]) => (
            <div key={key}>
              <span className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-2">{label}</span>
              {value ? (
                <div className="flex items-center gap-3">
                  <img src={safeImageUrl(value)} alt="" className={`${key === "cover" ? "w-28 h-16" : "w-16 h-16"} rounded-xl object-cover border border-primary-200 dark:border-stone-700`} />
                  <Button variant="secondary" size="xs" onClick={() => { setter(""); setUploadTarget(key); }}>{t("groups.wizard.replace")}</Button>
                </div>
              ) : (
                <Button variant="secondary" size="xs" onClick={() => setUploadTarget(uploadTarget === key ? null : key)}>{t("groups.wizard.upload")}</Button>
              )}
              {uploadTarget === key && !value && (
                <div className="mt-2">
                  <ImageUpload onUpload={urls => { setter(urls.large || urls.original); setUploadTarget(null); }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Categories */}
        <div>
          <span className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-2">{t("groups.manage.categories_label")}</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.flatMap(f => f.items.map(i => `${f.family} / ${i}`)).map(full => {
              const isSel = categories.includes(full);
              return (
                <button
                  key={full}
                  aria-pressed={isSel}
                  onClick={() => setCategories(prev => isSel ? prev.filter(x => x !== full) : [...prev, full])}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${isSel ? "bg-primary-600 text-cream border-primary-600" : "border-primary-200/60 dark:border-stone-700 text-stone-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/20"}`}
                >
                  {full.split(" / ")[1]}
                </button>
              );
            })}
          </div>
        </div>

        <Textarea label={t("groups.manage.conduct_label")} value={conduct} maxLength={10000} rows={4} onChange={e => setConduct(e.target.value)} />
      </Card>

      {/* Visibility */}
      <Card variant="plain" className="p-6 space-y-3">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.manage.section_visibility")}</h2>
        <p className="text-sm text-stone-500">{t("groups.manage.visibility_help")}</p>
        {VISIBILITY_SECTIONS.map(k => (
          <div key={k} className="flex items-center justify-between py-1.5">
            <span className="text-sm text-stone-700 dark:text-stone-300">{t(`groups.wizard.section_${k}`)}</span>
            <Toggle
              id={`manage-vis-${k}`}
              label={visibility[k] ? t("groups.wizard.visibility_public") : t("groups.wizard.visibility_members")}
              checked={visibility[k]}
              onChange={e => setVisibility(prev => ({ ...prev, [k]: e.target.checked }))}
            />
          </div>
        ))}
      </Card>

      {/* Membership */}
      <Card variant="plain" className="p-6 space-y-3">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.manage.membership_title")}</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-700 dark:text-stone-300">{t("groups.manage.open_join")}</span>
          <Toggle
            id="manage-open-join"
            label={openJoin ? t("groups.wizard.toggle_on") : t("groups.wizard.toggle_off")}
            checked={openJoin}
            onChange={e => setOpenJoin(e.target.checked)}
          />
        </div>
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={!dirty || saving || !!nameError} loading={saving}>
          {saving ? t("groups.manage.saving") : t("groups.manage.save")}
        </Button>
      </div>
    </div>
  );
}
