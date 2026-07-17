"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { PartyPopper, Check } from "lucide-react";

const COVER_LIBRARY = [
  { id: "garden", url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=70", label: "Horta" },
  { id: "field", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70", label: "Campo" },
  { id: "market", url: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=70", label: "Mercado" },
  { id: "forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70&sat=-20", label: "Floresta" },
];
const LOGO_LIBRARY = [
  { id: "leaf", url: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=200&q=70", label: "Folha" },
  { id: "sprout", url: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200&q=70", label: "Rebento" },
  { id: "tomato", url: "https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=200&q=70", label: "Tomate" },
  { id: "hands", url: "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=200&q=70", label: "Mãos" },
];

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

const CONDUCT_TEMPLATE = `Somos abertos a todos, independentemente da experiência. Partilhamos conhecimento livremente, creditamos onde aprendemos as coisas, e acolhemos perguntas. Não toleramos qualquer tipo de assédio. Desacordos sobre técnica são bem-vindos; ataques a pessoas não.`;

// ── Validation ──────────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;
const URL_RE = /^https?:\/\/\S+$/i;

type Phase = "step1" | "step2" | "exit" | "guided";

const VISIBILITY_SECTIONS = ["announcements", "contacts", "calendar", "members", "chats", "documents", "gallery"] as const;
const MEMBERSHIP_METHODS = ["linkInvite", "platformInvite", "qrEvent", "prospectQR", "orgAuto"] as const;

let rowSeq = 0;
const nextRowId = () => ++rowSeq;

export default function CreateGroupPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { addToast } = useToast();

  const [phase, setPhase] = useState<Phase>("step1");
  const [guidedStep, setGuidedStep] = useState(0);
  const [type, setType] = useState<"organic" | "structured" | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  // true = public, false = members-only (matches the server's convention)
  const [visibility, setVisibility] = useState<Record<string, boolean>>({
    announcements: false, contacts: true, calendar: true, members: false, chats: false, documents: true, gallery: true,
  });
  const [conduct, setConduct] = useState("");
  const [programs, setPrograms] = useState<{ rid: number; name: string; subfields: string }[]>([]);
  const [contacts, setContacts] = useState({ address: "", phone: "", email: "", website: "", hours: "" });
  const [contactErrors, setContactErrors] = useState<{ phone?: string; email?: string; website?: string }>({});
  const [chats, setChats] = useState<{ rid: number; name: string; url: string; urlError?: string }[]>([]);
  const [membership, setMembership] = useState<Record<string, boolean>>({
    linkInvite: true, platformInvite: false, qrEvent: false, prospectQR: false, orgAuto: false,
  });
  const [openJoin, setOpenJoin] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<number | null>(null);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const GUIDED_STEPS = [
    t("groups.wizard.categories_label"),
    t("groups.wizard.guided_step_visibility"),
    t("groups.wizard.guided_step_conduct"),
    t("groups.wizard.guided_step_programs"),
    t("groups.wizard.guided_step_contacts"),
    t("groups.wizard.guided_step_chats"),
    t("groups.wizard.guided_step_membership"),
  ];

  // Anything typed but not yet persisted counts as dirty.
  const dirty =
    (phase === "step1" && type !== null) ||
    (phase === "step2" && (!!name || !!slug || !!description)) ||
    phase === "guided";
  useDirtyGuard(dirty && !saving, { message: t("groups.wizard.dirty_message") });

  const slugify = (s: string) =>
    s.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents (horta-do-joão → horta-do-joao)
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const nameError = name.length > 0 && name.trim().length < 2 ? t("groups.wizard.name_error") : undefined;
  const slugError = slugTaken
    ? t("groups.wizard.slug_taken")
    : slug.length > 0 && !SLUG_RE.test(slug)
      ? t("groups.wizard.slug_error")
      : undefined;

  const checkSlugAvailability = (value: string) => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    setSlugTaken(false);
    if (!value || !SLUG_RE.test(value)) return;
    slugCheckTimer.current = setTimeout(async () => {
      try {
        await api.groups.getBySlug(value);
        setSlugTaken(true); // found → taken
      } catch {
        setSlugTaken(false); // 404 → free
      }
    }, 450);
  };

  const validateContacts = (): boolean => {
    const errs: typeof contactErrors = {};
    if (contacts.email && !EMAIL_RE.test(contacts.email)) errs.email = t("groups.wizard.email_error");
    if (contacts.phone && !PHONE_RE.test(contacts.phone)) errs.phone = t("groups.wizard.phone_error");
    if (contacts.website && !URL_RE.test(contacts.website)) errs.website = t("groups.wizard.url_error");
    setContactErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateChats = (): boolean => {
    let ok = true;
    setChats(prev => prev.map(c => {
      if (c.url && !URL_RE.test(c.url)) { ok = false; return { ...c, urlError: t("groups.wizard.url_error") }; }
      return { ...c, urlError: undefined };
    }));
    return ok;
  };

  /** Step 2 → creates the group ONCE; back-navigation re-submits as PATCH. */
  const saveEssentials = async (): Promise<number | null> => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description || undefined,
        group_type: (type || "organic") as "organic" | "structured",
        image_url: cover || undefined,
        logo_url: logo || undefined,
        location: location || undefined,
        is_open: openJoin,
      };
      if (createdGroupId) {
        await api.groups.update(createdGroupId, payload);
        return createdGroupId;
      }
      const g = await api.groups.create({ ...payload, slug });
      setCreatedGroupId(g.id);
      return g.id;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (/slug/i.test(msg)) setSlugTaken(true);
      addToast("error", msg || t("groups.wizard.create_error"));
      return null;
    } finally {
      setSaving(false);
    }
  };

  /** Persists EVERYTHING the guided flow collected (the old wizard silently dropped it). */
  const finishGuided = async () => {
    if (!createdGroupId) return;
    setSaving(true);
    let hadErrors = false;
    try {
      await api.groups.update(createdGroupId, {
        categories: categories.length > 0 ? JSON.stringify(categories) : undefined,
        visibility_config: JSON.stringify(visibility),
        membership_config: JSON.stringify(membership),
        conduct: conduct || undefined,
        is_open: openJoin,
      });
    } catch { hadErrors = true; }
    for (const p of programs) {
      if (!p.name.trim()) continue;
      try {
        const prog = await api.groups.createProgram(createdGroupId, { name: p.name.trim() });
        const sfs = p.subfields.split(",").map(s => s.trim()).filter(Boolean);
        for (const sf of sfs) await api.groups.createSubfield(createdGroupId, prog.id, { name: sf });
      } catch { hadErrors = true; }
    }
    if (contacts.address || contacts.phone || contacts.email || contacts.website || contacts.hours) {
      try {
        await api.groups.createContact(createdGroupId, {
          label: "Sede",
          address: contacts.address || undefined,
          phone: contacts.phone || undefined,
          email: contacts.email || undefined,
          website: contacts.website || undefined,
          hours: contacts.hours || undefined,
          is_public: visibility.contacts,
        });
      } catch { hadErrors = true; }
    }
    for (const ch of chats) {
      if (!ch.name || !ch.url) continue;
      try { await api.groups.createChat(createdGroupId, { name: ch.name, url: ch.url }); }
      catch { hadErrors = true; }
    }
    setSaving(false);
    if (hadErrors) addToast("warning", t("groups.wizard.finish_error"));
    else addToast("success", t("groups.wizard.created_title", { name }));
    router.push(`/groups/${slug}`);
  };

  const step2Valid = name.trim().length >= 2 && SLUG_RE.test(slug) && !slugTaken;

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-950">
      <div className="border-b border-primary-100 dark:border-stone-800 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push("/groups")} className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
          {t("groups.wizard.back_to_groups")}
        </button>
        <span className="text-stone-300" aria-hidden>/</span>
        <span className="font-display font-medium text-sm text-primary-700 dark:text-primary-300">{t("groups.create_group")}</span>
        {phase === "guided" && (
          <span className="ml-auto text-xs text-stone-400">
            {t("groups.wizard.progress_label", { current: guidedStep + 1, total: GUIDED_STEPS.length })}
          </span>
        )}
      </div>

      <div className="flex justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          {/* ── STEP 1 — type ── */}
          {phase === "step1" && (
            <div>
              <p className="text-xs font-display font-medium tracking-widest uppercase text-earth-500 mb-3">1 / 2</p>
              <h1 className="font-display text-3xl font-semibold text-primary-800 dark:text-primary-200 mb-2">{t("groups.wizard.step1_title")}</h1>
              <p className="text-stone-500 text-sm mb-8 max-w-lg">{t("groups.wizard.step1_note")}</p>
              <div className="grid sm:grid-cols-2 gap-4" role="radiogroup" aria-label={t("groups.wizard.step1_title")}>
                <button
                  role="radio" aria-checked={type === "organic"}
                  onClick={() => setType("organic")}
                  className={`text-left p-6 rounded-2xl border-2 transition ${type === "organic" ? "border-primary-600 bg-primary-50/50 dark:bg-primary-900/20" : "border-primary-200/60 dark:border-stone-700 hover:border-primary-300"}`}
                >
                  <Badge variant="green">{t("groups.type_organic")}</Badge>
                  <h3 className="font-display text-lg font-semibold mt-3 text-stone-800 dark:text-stone-100">{t("groups.wizard.organic_title")}</h3>
                  <p className="text-sm text-stone-500 mt-1">{t("groups.wizard.organic_desc")}</p>
                </button>
                <button
                  role="radio" aria-checked={type === "structured"}
                  onClick={() => setType("structured")}
                  className={`text-left p-6 rounded-2xl border-2 transition ${type === "structured" ? "border-primary-600 bg-primary-50/50 dark:bg-primary-900/20" : "border-primary-200/60 dark:border-stone-700 hover:border-primary-300"}`}
                >
                  <Badge variant="earth">{t("groups.type_structured")}</Badge>
                  <h3 className="font-display text-lg font-semibold mt-3 text-stone-800 dark:text-stone-100">{t("groups.wizard.structured_title")}</h3>
                  <p className="text-sm text-stone-500 mt-1">{t("groups.wizard.structured_desc")}</p>
                </button>
              </div>
              <div className="mt-8 flex justify-end">
                <Button disabled={!type} onClick={() => setPhase("step2")}>{t("groups.wizard.continue")}</Button>
              </div>
            </div>
          )}

          {/* ── STEP 2 — essentials ── */}
          {phase === "step2" && (
            <div>
              <p className="text-xs font-display font-medium tracking-widest uppercase text-earth-500 mb-3">2 / 2</p>
              <h1 className="font-display text-3xl font-semibold text-primary-800 dark:text-primary-200 mb-6">{t("groups.wizard.step2_title")}</h1>
              <div className="space-y-5">
                <Input
                  label={t("groups.wizard.name_label")}
                  placeholder={t("groups.wizard.name_placeholder")}
                  value={name}
                  error={nameError}
                  maxLength={255}
                  onChange={e => {
                    setName(e.target.value);
                    if (!slugTouched && !createdGroupId) {
                      const s = slugify(e.target.value);
                      setSlug(s);
                      checkSlugAvailability(s);
                    }
                  }}
                />
                <div>
                  <Input
                    label={t("groups.wizard.slug_label")}
                    placeholder="horta-do-bairro"
                    value={slug}
                    error={slugError}
                    disabled={!!createdGroupId}
                    maxLength={100}
                    onChange={e => {
                      setSlugTouched(true);
                      const s = slugify(e.target.value);
                      setSlug(s);
                      checkSlugAvailability(s);
                    }}
                  />
                  <p className="text-xs text-stone-400 mt-1">rootlink.pt/groups/{slug || "…"}</p>
                </div>
                <Textarea
                  label={t("groups.wizard.description_label")}
                  placeholder={t("groups.wizard.description_placeholder")}
                  value={description}
                  maxLength={2000}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                />
                <ImagePicker label={t("groups.wizard.cover_label")} shape="wide" value={cover} library={COVER_LIBRARY} onPick={setCover} />
                <ImagePicker label={t("groups.wizard.logo_label")} shape="square" value={logo} library={LOGO_LIBRARY} onPick={setLogo} />
                <Input
                  label={t("groups.wizard.location_label")}
                  placeholder={t("groups.wizard.location_placeholder")}
                  value={location}
                  maxLength={255}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setPhase("step1")}>{t("groups.wizard.back")}</Button>
                <Button
                  disabled={!step2Valid || saving}
                  loading={saving}
                  onClick={async () => {
                    const gid = await saveEssentials();
                    if (gid) setPhase("exit");
                  }}
                >
                  {saving ? t("groups.wizard.creating") : t("groups.wizard.continue")}
                </Button>
              </div>
            </div>
          )}

          {/* ── EXIT DOORS ── */}
          {phase === "exit" && (
            <div>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 mx-auto grid place-items-center mb-4">
                  <PartyPopper className="w-7 h-7 text-emerald-600" aria-hidden />
                </div>
                <h1 className="font-display text-3xl font-semibold text-primary-800 dark:text-primary-200">{t("groups.wizard.created_title", { name })}</h1>
                <p className="text-stone-500 text-sm mt-2">{t("groups.wizard.created_subtitle")}</p>
              </div>
              <div className="grid gap-3">
                <button onClick={() => router.push(`/groups/${slug}`)} className="text-left p-5 rounded-2xl border-2 border-primary-200/60 dark:border-stone-700 hover:border-primary-300 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition w-full">
                  <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.wizard.finish_later")}</h3>
                  <p className="text-sm text-stone-500 mt-1">{t("groups.wizard.finish_later_desc")}</p>
                </button>
                <button onClick={() => router.push(`/groups/${slug}/manage`)} className="text-left p-5 rounded-2xl border-2 border-primary-200/60 dark:border-stone-700 hover:border-primary-300 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition w-full">
                  <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.wizard.go_manage")}</h3>
                  <p className="text-sm text-stone-500 mt-1">{t("groups.wizard.go_manage_desc")}</p>
                </button>
                <button onClick={() => setPhase("guided")} className="text-left p-5 rounded-2xl border-2 border-primary-600 bg-primary-50/50 dark:bg-primary-900/20 hover:shadow-md transition w-full">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.wizard.guided")}</h3>
                    <Badge variant="sage">{t("groups.wizard.recommended")}</Badge>
                  </div>
                  <p className="text-sm text-stone-500 mt-1">{t("groups.wizard.guided_desc")}</p>
                </button>
              </div>
            </div>
          )}

          {/* ── GUIDED FLOW ── */}
          {phase === "guided" && (
            <div>
              <div
                className="flex items-center gap-2 mb-8"
                role="progressbar"
                aria-valuemin={1} aria-valuemax={GUIDED_STEPS.length} aria-valuenow={guidedStep + 1}
                aria-label={t("groups.wizard.progress_label", { current: guidedStep + 1, total: GUIDED_STEPS.length })}
              >
                {GUIDED_STEPS.map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`h-2 rounded-full transition-all ${i === guidedStep ? "w-8 bg-primary-600" : i < guidedStep ? "w-2 bg-primary-400" : "w-2 bg-primary-200 dark:bg-stone-700"}`} />
                    {i === guidedStep && <span className="text-xs font-display font-medium text-primary-600 dark:text-primary-300">{label}</span>}
                  </div>
                ))}
              </div>

              {/* 0 — categories */}
              {guidedStep === 0 && (
                <GuidedStep
                  title={t("groups.wizard.categories_label")}
                  help={t("groups.wizard.categories_help")}
                  onSkip={() => setGuidedStep(1)} onNext={() => setGuidedStep(1)}
                  skipLabel={t("groups.wizard.skip")} nextLabel={t("groups.wizard.next")}
                >
                  <CategoryPicker selected={categories} onToggle={c => setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
                </GuidedStep>
              )}

              {/* 1 — visibility */}
              {guidedStep === 1 && (
                <GuidedStep
                  title={t("groups.wizard.guided_step_visibility")}
                  help={t("groups.wizard.guided_step_visibility_help")}
                  onSkip={() => setGuidedStep(2)} onNext={() => setGuidedStep(2)}
                  skipLabel={t("groups.wizard.skip")} nextLabel={t("groups.wizard.next")}
                >
                  {VISIBILITY_SECTIONS.map(k => (
                    <Card variant="plain" key={k} className="p-4 flex items-center justify-between mb-2">
                      <p className="text-sm text-stone-700 dark:text-stone-300">{t(`groups.wizard.section_${k}`)}</p>
                      <Toggle
                        id={`vis-${k}`}
                        label={visibility[k] ? t("groups.wizard.visibility_public") : t("groups.wizard.visibility_members")}
                        checked={visibility[k]}
                        onChange={e => setVisibility(prev => ({ ...prev, [k]: e.target.checked }))}
                      />
                    </Card>
                  ))}
                </GuidedStep>
              )}

              {/* 2 — conduct */}
              {guidedStep === 2 && (
                <GuidedStep
                  title={t("groups.wizard.guided_step_conduct")}
                  help={t("groups.wizard.guided_step_conduct_help")}
                  onSkip={() => setGuidedStep(3)} onNext={() => setGuidedStep(3)}
                  skipLabel={t("groups.wizard.skip")} nextLabel={t("groups.wizard.next")}
                >
                  <Button variant="secondary" size="sm" className="mb-4" onClick={() => setConduct(CONDUCT_TEMPLATE)}>
                    {t("groups.wizard.use_template")}
                  </Button>
                  <Textarea aria-label={t("groups.wizard.guided_step_conduct")} value={conduct} maxLength={10000} onChange={e => setConduct(e.target.value)} rows={6} />
                </GuidedStep>
              )}

              {/* 3 — programs */}
              {guidedStep === 3 && (
                <GuidedStep
                  title={t("groups.wizard.guided_step_programs")}
                  help={t("groups.wizard.guided_step_programs_help")}
                  onSkip={() => setGuidedStep(4)} onNext={() => setGuidedStep(4)}
                  skipLabel={t("groups.wizard.skip")} nextLabel={t("groups.wizard.next")}
                >
                  {programs.map(p => (
                    <Card variant="plain" key={p.rid} className="p-4 mb-3 space-y-2">
                      <Input
                        aria-label={t("groups.wizard.program_placeholder")}
                        placeholder={t("groups.wizard.program_placeholder")}
                        value={p.name} maxLength={200}
                        onChange={e => setPrograms(prev => prev.map(x => x.rid === p.rid ? { ...x, name: e.target.value } : x))}
                      />
                      <Input
                        aria-label="Subcampos"
                        placeholder="Subcampos, separados por vírgulas (ex.: Iniciados, Juvenis, Seniores)"
                        value={p.subfields}
                        onChange={e => setPrograms(prev => prev.map(x => x.rid === p.rid ? { ...x, subfields: e.target.value } : x))}
                      />
                      <Button variant="ghost" size="xs" onClick={() => setPrograms(prev => prev.filter(x => x.rid !== p.rid))}>
                        {t("groups.wizard.remove")}
                      </Button>
                    </Card>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setPrograms(prev => [...prev, { rid: nextRowId(), name: "", subfields: "" }])}>
                    {t("groups.wizard.add_program")}
                  </Button>
                </GuidedStep>
              )}

              {/* 4 — contacts */}
              {guidedStep === 4 && (
                <GuidedStep
                  title={t("groups.wizard.guided_step_contacts")}
                  help={t("groups.wizard.guided_step_contacts_help")}
                  onSkip={() => setGuidedStep(5)}
                  onNext={() => { if (validateContacts()) setGuidedStep(5); }}
                  skipLabel={t("groups.wizard.skip")} nextLabel={t("groups.wizard.next")}
                >
                  <div className="space-y-3">
                    <Input label={t("groups.wizard.address_label")} placeholder="Largo das Olarias, Lisboa" value={contacts.address} onChange={e => setContacts(prev => ({ ...prev, address: e.target.value }))} />
                    <Input label={t("groups.wizard.phone_label")} type="tel" inputMode="tel" placeholder="+351 210 000 000" value={contacts.phone} error={contactErrors.phone}
                      onChange={e => setContacts(prev => ({ ...prev, phone: e.target.value }))} onBlur={validateContacts} />
                    <Input label={t("groups.wizard.email_label")} type="email" inputMode="email" placeholder="horta@exemplo.pt" value={contacts.email} error={contactErrors.email}
                      onChange={e => setContacts(prev => ({ ...prev, email: e.target.value }))} onBlur={validateContacts} />
                    <Input label={t("groups.wizard.website_label")} type="url" inputMode="url" placeholder="https://exemplo.pt" value={contacts.website} error={contactErrors.website}
                      onChange={e => setContacts(prev => ({ ...prev, website: e.target.value }))} onBlur={validateContacts} />
                    <Input label={t("groups.wizard.hours_label")} placeholder="Sábados de manhã, 10:00" value={contacts.hours} onChange={e => setContacts(prev => ({ ...prev, hours: e.target.value }))} />
                  </div>
                </GuidedStep>
              )}

              {/* 5 — chats */}
              {guidedStep === 5 && (
                <GuidedStep
                  title={t("groups.wizard.guided_step_chats")}
                  help={t("groups.wizard.guided_step_chats_help")}
                  onSkip={() => setGuidedStep(6)}
                  onNext={() => { if (validateChats()) setGuidedStep(6); }}
                  skipLabel={t("groups.wizard.skip")} nextLabel={t("groups.wizard.next")}
                >
                  {chats.map(c => (
                    <Card variant="plain" key={c.rid} className="p-4 mb-3 space-y-2">
                      <Input aria-label={t("groups.wizard.chat_name_placeholder")} placeholder={t("groups.wizard.chat_name_placeholder")} value={c.name} maxLength={100}
                        onChange={e => setChats(prev => prev.map(x => x.rid === c.rid ? { ...x, name: e.target.value } : x))} />
                      <Input aria-label={t("groups.wizard.chat_url_placeholder")} type="url" inputMode="url" placeholder={t("groups.wizard.chat_url_placeholder")} value={c.url} error={c.urlError}
                        onChange={e => setChats(prev => prev.map(x => x.rid === c.rid ? { ...x, url: e.target.value, urlError: undefined } : x))} />
                      <Button variant="ghost" size="xs" onClick={() => setChats(prev => prev.filter(x => x.rid !== c.rid))}>
                        {t("groups.wizard.remove")}
                      </Button>
                    </Card>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setChats(prev => [...prev, { rid: nextRowId(), name: "", url: "" }])}>
                    {t("groups.wizard.add_chat")}
                  </Button>
                </GuidedStep>
              )}

              {/* 6 — membership (climax) */}
              {guidedStep === 6 && (
                <div>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/40 mx-auto grid place-items-center mb-3">
                      <PartyPopper className="w-7 h-7 text-primary-500" aria-hidden />
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-stone-800 dark:text-stone-100">{t("groups.wizard.guided_step_membership")}</h2>
                    <p className="text-stone-500 text-sm mt-1">{t("groups.wizard.guided_step_membership_help")}</p>
                  </div>
                  <div className="space-y-3">
                    <Card variant="plain" className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{t("groups.wizard.open_join_label")}</p>
                        <p className="text-xs text-stone-400">{t("groups.wizard.open_join_desc")}</p>
                      </div>
                      <Toggle id="open-join" label={openJoin ? t("groups.wizard.toggle_on") : t("groups.wizard.toggle_off")} checked={openJoin} onChange={e => setOpenJoin(e.target.checked)} />
                    </Card>
                    {MEMBERSHIP_METHODS.map(k => (
                      <Card variant="plain" key={k} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{t(`groups.wizard.membership_${k}`)}</p>
                          <p className="text-xs text-stone-400">{t(`groups.wizard.membership_${k}_desc`)}</p>
                        </div>
                        <Toggle
                          id={`mem-${k}`}
                          label={membership[k] ? t("groups.wizard.toggle_on") : t("groups.wizard.toggle_off")}
                          checked={membership[k]}
                          onChange={e => setMembership(prev => ({ ...prev, [k]: e.target.checked }))}
                        />
                      </Card>
                    ))}
                  </div>
                  <div className="mt-8 text-center">
                    <Button size="lg" onClick={finishGuided} disabled={saving} loading={saving}>
                      {saving ? t("groups.wizard.finishing") : t("groups.wizard.finish")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GuidedStep({ title, help, children, onSkip, onNext, skipLabel, nextLabel }: {
  title: string; help?: string; children: React.ReactNode;
  onSkip: () => void; onNext: () => void; skipLabel: string; nextLabel: string;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-2 text-stone-800 dark:text-stone-100">{title}</h2>
      {help && <p className="text-stone-500 text-sm mb-6">{help}</p>}
      {children}
      <div className="mt-8 flex justify-between">
        <Button variant="ghost" size="sm" onClick={onSkip}>{skipLabel} →</Button>
        <Button onClick={onNext}>{nextLabel}</Button>
      </div>
    </div>
  );
}

function ImagePicker({ label, shape, value, library, onPick }: {
  label: string; shape: "wide" | "square"; value: string | null;
  library: { id: string; url: string; label: string }[];
  onPick: (url: string | null) => void;
}) {
  const { t } = useLocale();
  const [mode, setMode] = useState<"idle" | "library" | "upload">("idle");
  const labelId = useMemo(() => `imgpick-${Math.random().toString(36).slice(2, 8)}`, []);

  if (value && mode === "idle") {
    return (
      <div>
        <span id={labelId} className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-2">{label}</span>
        <div className="flex items-center gap-4">
          <div className={`${shape === "wide" ? "w-32 h-16" : "w-16 h-16"} rounded-xl overflow-hidden border border-primary-200 dark:border-stone-700`}>
            <img src={value} alt="" className="w-full h-full object-cover" />
          </div>
          <Button variant="secondary" size="sm" onClick={() => onPick(null)}>{t("groups.wizard.replace")}</Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <span id={labelId} className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-2">{label}</span>
      <div className="flex gap-2" role="group" aria-labelledby={labelId}>
        <Button variant="secondary" size="sm" onClick={() => setMode(mode === "upload" ? "idle" : "upload")}>{t("groups.wizard.upload")}</Button>
        <Button variant="secondary" size="sm" onClick={() => setMode(mode === "library" ? "idle" : "library")}>{t("groups.wizard.pick_library")}</Button>
      </div>
      {mode === "upload" && (
        <div className="mt-3">
          <ImageUpload
            onUpload={urls => { onPick(urls.large || urls.original); setMode("idle"); }}
            maxSizeMb={10}
          />
        </div>
      )}
      {mode === "library" && (
        <div className="mt-3">
          <div className="grid grid-cols-4 gap-2">
            {library.map(img => (
              <button
                key={img.id}
                onClick={() => { onPick(img.url); setMode("idle"); }}
                aria-label={img.label}
                className={`${shape === "wide" ? "aspect-video" : "aspect-square"} rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-400 focus-visible:border-primary-400 transition`}
              >
                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <Button variant="ghost" size="xs" className="mt-2" onClick={() => setMode("idle")}>{t("groups.wizard.close")}</Button>
        </div>
      )}
    </div>
  );
}

function CategoryPicker({ selected, onToggle }: { selected: string[]; onToggle: (cat: string) => void }) {
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {CATEGORIES.map(fam => {
        const isOpen = openFamily === fam.family;
        const count = fam.items.filter(i => selected.includes(`${fam.family} / ${i}`)).length;
        return (
          <div key={fam.family} className="border border-primary-200/60 dark:border-stone-700 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-primary-50/30 dark:hover:bg-primary-900/20"
              aria-expanded={isOpen}
              onClick={() => setOpenFamily(isOpen ? null : fam.family)}
            >
              <span>
                {fam.family}
                {count > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300 ml-2">{count}</span>}
              </span>
              <span aria-hidden className={`text-stone-400 text-xs transition ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {fam.items.map(item => {
                  const full = `${fam.family} / ${item}`;
                  const isSel = selected.includes(full);
                  return (
                    <button
                      key={item}
                      onClick={() => onToggle(full)}
                      aria-pressed={isSel}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${isSel ? "bg-primary-600 text-cream border-primary-600" : "border-primary-200/60 dark:border-stone-700 text-stone-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/20"}`}
                    >
                      {item}{isSel && <Check className="w-3 h-3 inline ml-1" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
