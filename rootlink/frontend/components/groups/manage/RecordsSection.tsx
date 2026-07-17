"use client";

/**
 * Manage → Records: contacts, governing bodies, documents, chat links and
 * gallery — the CRUD surfaces that previously had no owner UI at all
 * (board members and documents could never be added; chats/contacts could
 * never be deleted).
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  Group, GroupContact, GroupBoardMember, GroupDocument, GroupChatLink, GroupGalleryItem,
  GroupProgram, GroupProgramSubField,
} from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { LoadError } from "@/components/studio/LoadError";
import { safeImageUrl } from "@/lib/image-url";
import { Trash2, Plus, Pencil } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;
const URL_RE = /^https?:\/\/\S+$/i;

type Tab = "contacts" | "board" | "documents" | "chats" | "gallery" | "programs";

export function RecordsSection({ group }: { group: Group }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("contacts");

  const tabs: { id: Tab; label: string }[] = [
    { id: "contacts", label: t("groups.manage.section_contacts") },
    { id: "programs", label: t("groups.tab_programs") },
    { id: "board", label: t("groups.manage.section_board") },
    { id: "documents", label: t("groups.manage.section_documents") },
    { id: "chats", label: t("groups.manage.section_chats") },
    { id: "gallery", label: t("groups.manage.section_gallery") },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-none" role="tablist">
        {tabs.map(x => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === x.id ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300" : "text-stone-500 hover:text-primary-700 dark:hover:text-primary-300"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === "contacts" && <ContactsPanel group={group} />}
      {tab === "programs" && <ProgramsPanel group={group} />}
      {tab === "board" && <BoardPanel group={group} />}
      {tab === "documents" && <DocumentsPanel group={group} />}
      {tab === "chats" && <ChatsPanel group={group} />}
      {tab === "gallery" && <GalleryPanel group={group} />}
    </div>
  );
}

/** Shared list scaffolding: load / error / empty / rows + add form. */
function useCrudList<T>(loader: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setError(false);
    try { setItems(await loader()); } catch { setError(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { items, setItems, error, load };
}

function PanelShell({ help, error, loading, onRetry, children }: {
  help: string; error: boolean; loading: boolean; onRetry: () => void; children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <Card variant="plain" className="p-5 space-y-4">
      <p className="text-sm text-stone-500">{help}</p>
      {error && <LoadError message={t("groups.group_load_error")} onRetry={onRetry} />}
      {!error && loading && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map(i => <div key={i} className="h-12 rounded-xl skeleton-shimmer" />)}
        </div>
      )}
      {!error && !loading && children}
    </Card>
  );
}

// ── Contacts ────────────────────────────────────────────────────────────────

function ContactsPanel({ group }: { group: Group }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const loader = useCallback(() => api.groups.contacts(group.id), [group.id]);
  const { items, setItems, error, load } = useCrudList<GroupContact>(loader);
const [form, setForm] = useState({ label: "Sede", address: "", phone: "", email: "", website: "", hours: "", is_public: false });
  const [errs, setErrs] = useState<{ phone?: string; email?: string; website?: string }>({});
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const validate = () => {
    const e: typeof errs = {};
    if (form.email && !EMAIL_RE.test(form.email)) e.email = t("groups.wizard.email_error");
    if (form.phone && !PHONE_RE.test(form.phone)) e.phone = t("groups.wizard.phone_error");
    if (form.website && !URL_RE.test(form.website)) e.website = t("groups.wizard.url_error");
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const startAdd = () => {
    setForm({ label: "Sede", address: "", phone: "", email: "", website: "", hours: "", is_public: false });
    setEditingId(null);
    setShowForm(true);
  };
  const startEdit = (c: GroupContact) => {
    setForm({
      label: c.label, address: c.address || "", phone: c.phone || "",
      email: c.email || "", website: c.website || "", hours: c.hours || "",
      is_public: c.is_public,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        label: form.label || "Sede",
        address: form.address || undefined, phone: form.phone || undefined,
        email: form.email || undefined, website: form.website || undefined,
        hours: form.hours || undefined, is_public: form.is_public,
      };
      if (editingId !== null) {
        const updated = await api.groups.updateContact(group.id, editingId, payload);
        setItems(prev => prev?.map(x => (x.id === editingId ? updated : x)) ?? null);
        addToast("success", t("groups.manage.contact_updated"));
      } else {
        const created = await api.groups.createContact(group.id, payload);
        setItems(prev => prev ? [...prev, created] : [created]);
        addToast("success", t("groups.manage.contact_added"));
      }
      setForm({ label: "Sede", address: "", phone: "", email: "", website: "", hours: "", is_public: false });
      setEditingId(null);
      setShowForm(false);
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.contact_error"));
    } finally { setSaving(false); }
  }

  const remove = async (c: GroupContact) => {
    if (!window.confirm(t("groups.manage.contact_delete_confirm"))) return;
    const prev = items;
    setItems(cur => cur?.filter(x => x.id !== c.id) ?? null);
    try {
      await api.groups.deleteContact(group.id, c.id);
      addToast("success", t("groups.manage.contact_deleted"));
    } catch (e: unknown) {
      setItems(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.contact_error"));
    }
  };

  return (
    <PanelShell help={t("groups.manage.contacts_help")} error={error} loading={items === null} onRetry={load}>
      {items?.length === 0 && !showForm && <p className="text-sm text-stone-400">{t("groups.no_contacts")}</p>}
      {items?.map(c => (
        <div key={c.id} className="flex items-start gap-3 py-2 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-100">
              {c.label}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${c.is_public ? "bg-emerald-500/15 text-emerald-600" : "bg-primary-100 dark:bg-primary-900/40 text-primary-500"}`}>
                {c.is_public ? t("groups.public_badge") : t("groups.members_badge")}
              </span>
            </p>
            <p className="text-xs text-stone-500">{[c.address, c.phone, c.email, c.website, c.hours].filter(Boolean).join(" · ")}</p>
          </div>
          <Button size="xs" variant="ghost" onClick={() => startEdit(c)} aria-label={t("groups.manage.edit_contact")}>
            <Pencil className="w-3.5 h-3.5" aria-hidden />
          </Button>
          <Button size="xs" variant="danger" onClick={() => remove(c)} aria-label={t("groups.manage.contact_delete_confirm")}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      {showForm ? (
        <div className="space-y-3 pt-2 border-t border-primary-100 dark:border-stone-800">
          <Input label={t("groups.manage.label_label")} value={form.label} maxLength={100} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          <Input label={t("groups.wizard.address_label")} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          <Input label={t("groups.wizard.phone_label")} type="tel" value={form.phone} error={errs.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} onBlur={validate} />
          <Input label={t("groups.wizard.email_label")} type="email" value={form.email} error={errs.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onBlur={validate} />
          <Input label={t("groups.wizard.website_label")} type="url" value={form.website} error={errs.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} onBlur={validate} />
          <Input label={t("groups.wizard.hours_label")} value={form.hours} maxLength={255} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
          <Toggle id="contact-public" label={t("groups.manage.contact_public")} checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingId(null); }}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={save} disabled={saving} loading={saving}>
              {editingId !== null ? t("groups.manage.manage_edit") : t("groups.manage.add_contact")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4" aria-hidden /> {t("groups.manage.add_contact")}
        </Button>
      )}
    </PanelShell>
  );
}

// ── Programs ────────────────────────────────────────────────────────────────

function ProgramsPanel({ group }: { group: Group }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const loader = useCallback(() => api.groups.programs(group.id), [group.id]);
  const { items, setItems, error, load } = useCrudList<GroupProgram>(loader);
  const [subfields, setSubfields] = useState<Record<number, GroupProgramSubField[]>>({});
  // per-category draft (item name) and per-program draft (category name)
  const [itemDrafts, setItemDrafts] = useState<Record<number, string>>({});
  const [catDrafts, setCatDrafts] = useState<Record<number, string>>({});
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!items) return;
    let cancelled = false;
    (async () => {
      const all = await Promise.all(items.map(p => api.groups.subfields(group.id, p.id).catch(() => [])));
      if (cancelled) return;
      const map: Record<number, GroupProgramSubField[]> = {};
      items.forEach((p, i) => { map[p.id] = all[i]; });
      setSubfields(map);
    })();
    return () => { cancelled = true; };
  }, [items, group.id]);

  // tree: categories (parent_id null) with their items
  const treeFor = (programId: number) => {
    const sfs = subfields[programId] ?? [];
    const itemsByParent = new Map<number, GroupProgramSubField[]>();
    for (const sf of sfs) if (sf.parent_id !== null) {
      const arr = itemsByParent.get(sf.parent_id) ?? []; arr.push(sf); itemsByParent.set(sf.parent_id, arr);
    }
    return sfs.filter(sf => sf.parent_id === null)
      .sort((a, b) => a.display_order - b.display_order)
      .map(cat => ({ cat, items: (itemsByParent.get(cat.id) ?? []).sort((a, b) => a.display_order - b.display_order) }));
  };

  const addProgram = async () => {
    if (!nameDraft.trim()) return;
    setSaving(true);
    try {
      const prog = await api.groups.createProgram(group.id, { name: nameDraft.trim() });
      setItems(prev => prev ? [...prev, prog] : [prog]);
      setSubfields(prev => ({ ...prev, [prog.id]: [] }));
      setNameDraft(""); setShowForm(false);
      addToast("success", t("groups.manage.saved_toast"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.save_error"));
    } finally { setSaving(false); }
  };

  const addCategory = async (p: GroupProgram) => {
    const name = (catDrafts[p.id] || "").trim();
    if (!name) return;
    try {
      const created = await api.groups.createSubfield(group.id, p.id, { name });
      setSubfields(prev => ({ ...prev, [p.id]: [...(prev[p.id] ?? []), created] }));
      setCatDrafts(cur => ({ ...cur, [p.id]: "" }));
      addToast("success", t("groups.manage.saved_toast"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.save_error"));
    }
  };

  const addItem = async (p: GroupProgram, catId: number) => {
    const name = (itemDrafts[catId] || "").trim();
    if (!name) return;
    try {
      const created = await api.groups.createSubfield(group.id, p.id, { name, parent_id: catId });
      setSubfields(prev => ({ ...prev, [p.id]: [...(prev[p.id] ?? []), created] }));
      setItemDrafts(cur => ({ ...cur, [catId]: "" }));
      addToast("success", t("groups.manage.saved_toast"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.save_error"));
    }
  };

  const removeProgram = async (p: GroupProgram) => {
    if (!window.confirm(t("groups.manage.program_delete_confirm", { name: p.name }))) return;
    setItems(cur => cur?.filter(x => x.id !== p.id) ?? null);
    try { await api.groups.deleteProgram(group.id, p.id); addToast("success", t("groups.manage.program_deleted")); }
    catch (e: unknown) { addToast("error", (e instanceof Error && e.message) || t("groups.manage.save_error")); }
  };

  const removeSubfield = async (p: GroupProgram, sf: GroupProgramSubField) => {
    const isCategory = sf.parent_id === null;
    if (!window.confirm(isCategory
      ? t("groups.manage.subfield_delete_confirm", { name: sf.name })
      : t("groups.manage.subfield_delete_confirm", { name: sf.name }))) return;
    setSubfields(cur => ({ ...cur, [p.id]: (cur[p.id] ?? []).filter(x => x.id !== sf.id && x.parent_id !== sf.id) }));
    try { await api.groups.deleteSubfield(group.id, p.id, sf.id); addToast("success", t("groups.manage.subfield_deleted")); }
    catch (e: unknown) {
      // refetch to restore accurate tree
      const fresh = await api.groups.subfields(group.id, p.id).catch(() => []);
      setSubfields(cur => ({ ...cur, [p.id]: fresh }));
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.save_error"));
    }
  };

  return (
    <PanelShell help={t("groups.wizard.guided_step_programs_help")} error={error} loading={items === null} onRetry={load}>
      {items?.length === 0 && !showForm && <p className="text-sm text-stone-400">{t("groups.no_programs")}</p>}
      {items?.map(p => {
        const tree = treeFor(p.id);
        return (
          <div key={p.id} className="py-3 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100 flex-1">{p.name}</p>
              <Button size="xs" variant="danger" onClick={() => removeProgram(p)} aria-label={t("groups.manage.program_delete_confirm", { name: p.name })}>
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {tree.map(({ cat, items }) => (
                <div key={cat.id} className="ml-2 pl-3 border-l border-primary-100 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-display font-[560] text-earth-500">{cat.name}</span>
                    <button onClick={() => removeSubfield(p, cat)} aria-label={t("groups.manage.subfield_delete_confirm", { name: cat.name })} className="text-xs text-stone-400 hover:text-rust-500">×</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {items.map(item => (
                      <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">
                        {item.name}
                        <button onClick={() => removeSubfield(p, item)} aria-label={t("groups.manage.subfield_delete_confirm", { name: item.name })} className="hover:text-rust-500">×</button>
                      </span>
                    ))}
                    <input
                      aria-label={t("groups.manage.subfield_add_label")}
                      placeholder={t("groups.manage.subfield_add_label")}
                      value={itemDrafts[cat.id] || ""}
                      onChange={e => setItemDrafts(cur => ({ ...cur, [cat.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") addItem(p, cat.id); }}
                      className="px-2.5 py-1 rounded-full text-xs border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 placeholder:text-stone-400 focus:border-primary-400 focus:outline-none w-32"
                    />
                  </div>
                </div>
              ))}
              {/* add category (level 2) */}
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  aria-label={t("groups.manage.category_add_label")}
                  placeholder={t("groups.manage.category_add_label")}
                  value={catDrafts[p.id] || ""}
                  onChange={e => setCatDrafts(cur => ({ ...cur, [p.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") addCategory(p); }}
                  className="px-2.5 py-1 rounded-full text-xs border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 placeholder:text-stone-400 focus:border-primary-400 focus:outline-none w-40"
                />
              </div>
            </div>
          </div>
        );
      })}
      {showForm ? (
        <div className="space-y-3 pt-2 border-t border-primary-100 dark:border-stone-800">
          <Input label={t("groups.wizard.program_placeholder")} value={nameDraft} maxLength={200} onChange={e => setNameDraft(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={addProgram} disabled={saving || !nameDraft.trim()} loading={saving}>{t("groups.wizard.add_program")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden /> {t("groups.wizard.add_program")}
        </Button>
      )}
    </PanelShell>
  );
}

// ── Board ───────────────────────────────────────────────────────────────────

function BoardPanel({ group }: { group: Group }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const loader = useCallback(() => api.groups.board(group.id), [group.id]);
  const { items, setItems, error, load } = useCrudList<GroupBoardMember>(loader);
  const [form, setForm] = useState({ body_name: "", member_name: "", role: "", term: "" });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const add = async () => {
    if (!form.body_name.trim() || !form.member_name.trim()) return;
    setSaving(true);
    try {
      const [term_start, term_end] = form.term.split(/[–-]/).map(s => s.trim());
      const created = await api.groups.createBoardMember(group.id, {
        body_name: form.body_name.trim(), member_name: form.member_name.trim(),
        role: form.role || undefined, term_start: term_start || undefined, term_end: term_end || undefined,
      });
      setItems(prev => prev ? [...prev, created] : [created]);
      setForm({ body_name: "", member_name: "", role: "", term: "" });
      setShowForm(false);
      addToast("success", t("groups.manage.board_added"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.board_error"));
    } finally { setSaving(false); }
  };

  const remove = async (b: GroupBoardMember) => {
    if (!window.confirm(t("groups.manage.board_delete_confirm", { name: b.member_name }))) return;
    const prev = items;
    setItems(cur => cur?.filter(x => x.id !== b.id) ?? null);
    try {
      await api.groups.deleteBoardMember(group.id, b.id);
      addToast("success", t("groups.manage.board_deleted"));
    } catch (e: unknown) {
      setItems(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.board_error"));
    }
  };

  return (
    <PanelShell help={t("groups.manage.board_help")} error={error} loading={items === null} onRetry={load}>
      {items?.map(b => (
        <div key={b.id} className="flex items-start gap-3 py-2 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-100">{b.member_name}</p>
            <p className="text-xs text-stone-500">
              {b.body_name}{b.role ? ` · ${b.role}` : ""}{b.term_start ? ` · ${b.term_start}${b.term_end ? `–${b.term_end}` : ""}` : ""}
            </p>
          </div>
          <Button size="xs" variant="danger" onClick={() => remove(b)} aria-label={t("groups.manage.board_delete_confirm", { name: b.member_name })}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      {showForm ? (
        <div className="space-y-3 pt-2 border-t border-primary-100 dark:border-stone-800">
          <Input label={t("groups.manage.body_label")} value={form.body_name} maxLength={100} onChange={e => setForm(f => ({ ...f, body_name: e.target.value }))} />
          <Input label={t("groups.manage.person_label")} value={form.member_name} maxLength={200} onChange={e => setForm(f => ({ ...f, member_name: e.target.value }))} />
          <Input label={t("groups.manage.role_label")} value={form.role} maxLength={100} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          <Input label={t("groups.manage.term_label")} value={form.term} maxLength={41} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={add} disabled={saving || !form.body_name.trim() || !form.member_name.trim()} loading={saving}>{t("groups.manage.add_board")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden /> {t("groups.manage.add_board")}
        </Button>
      )}
    </PanelShell>
  );
}

// ── Documents ───────────────────────────────────────────────────────────────

function DocumentsPanel({ group }: { group: Group }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const loader = useCallback(() => api.groups.documents(group.id), [group.id]);
  const { items, setItems, error, load } = useCrudList<GroupDocument>(loader);
  const [form, setForm] = useState({ title: "", file_url: "", doc_type: "other", is_public: false });
  const [urlError, setUrlError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const DOC_TYPES = ["estatutos", "relatorio", "ata", "regulamento", "other"];

  const add = async () => {
    if (!form.title.trim()) return;
    if (!URL_RE.test(form.file_url) && !form.file_url.startsWith("/")) {
      setUrlError(t("groups.wizard.url_error"));
      return;
    }
    setSaving(true);
    try {
      const created = await api.groups.createDocument(group.id, {
        title: form.title.trim(), file_url: form.file_url, doc_type: form.doc_type, is_public: form.is_public,
      });
      setItems(prev => prev ? [...prev, created] : [created]);
      setForm({ title: "", file_url: "", doc_type: "other", is_public: false });
      setShowForm(false);
      addToast("success", t("groups.manage.document_added"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.document_error"));
    } finally { setSaving(false); }
  };

  const togglePublic = async (d: GroupDocument) => {
    // optimistic flip on the per-document privacy flag
    const next = !d.is_public;
    setItems(cur => cur?.map(x => (x.id === d.id ? { ...x, is_public: next } : x)) ?? null);
    try {
      await api.groups.updateDocument(group.id, d.id, { is_public: next });
      addToast("success", t("groups.manage.document_updated"));
    } catch (e: unknown) {
      setItems(cur => cur?.map(x => (x.id === d.id ? { ...x, is_public: d.is_public } : x)) ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.document_error"));
    }
  };

  const remove = async (d: GroupDocument) => {
    if (!window.confirm(t("groups.manage.document_delete_confirm", { title: d.title }))) return;
    const prev = items;
    setItems(cur => cur?.filter(x => x.id !== d.id) ?? null);
    try {
      await api.groups.deleteDocument(group.id, d.id);
      addToast("success", t("groups.manage.document_deleted"));
    } catch (e: unknown) {
      setItems(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.document_error"));
    }
  };

  return (
    <PanelShell help={t("groups.manage.documents_help")} error={error} loading={items === null} onRetry={load}>
      {items?.length === 0 && !showForm && <p className="text-sm text-stone-400">{t("groups.no_documents")}</p>}
      {items?.map(d => (
        <div key={d.id} className="flex items-start gap-3 py-2 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-100">
              {d.title}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">{t(`groups.manage.doc_type_${d.doc_type}`)}</p>
            <Toggle
              id={`doc-public-${d.id}`}
              label={t("groups.manage.doc_public")}
              checked={d.is_public}
              onChange={() => togglePublic(d)}
              className="mt-2"
            />
          </div>
          <Button size="xs" variant="danger" onClick={() => remove(d)} aria-label={t("groups.manage.document_delete_confirm", { title: d.title })}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      {showForm ? (
        <div className="space-y-3 pt-2 border-t border-primary-100 dark:border-stone-800">
          <Input label={t("groups.manage.doc_title_label")} value={form.title} maxLength={255} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input label={t("groups.manage.doc_url_label")} type="url" value={form.file_url} error={urlError}
            onChange={e => { setForm(f => ({ ...f, file_url: e.target.value })); setUrlError(undefined); }} />
          <div>
            <span className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-1.5">{t("groups.manage.doc_type_label")}</span>
            <div className="flex flex-wrap gap-1.5">
              {DOC_TYPES.map(dt => (
                <button key={dt} aria-pressed={form.doc_type === dt} onClick={() => setForm(f => ({ ...f, doc_type: dt }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${form.doc_type === dt ? "bg-primary-600 text-cream border-primary-600" : "border-primary-200/60 dark:border-stone-700 text-stone-500"}`}>
                  {t(`groups.manage.doc_type_${dt}`)}
                </button>
              ))}
            </div>
          </div>
          <Toggle id="doc-public" label={t("groups.manage.doc_public")} checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={add} disabled={saving || !form.title.trim() || !form.file_url} loading={saving}>{t("groups.manage.add_document")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden /> {t("groups.manage.add_document")}
        </Button>
      )}
    </PanelShell>
  );
}

// ── Chats ───────────────────────────────────────────────────────────────────

function ChatsPanel({ group }: { group: Group }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const loader = useCallback(() => api.groups.chats(group.id), [group.id]);
  const { items, setItems, error, load } = useCrudList<GroupChatLink>(loader);
  const [form, setForm] = useState({ name: "", url: "" });
  const [urlError, setUrlError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const add = async () => {
    if (!form.name.trim()) return;
    if (!URL_RE.test(form.url)) { setUrlError(t("groups.wizard.url_error")); return; }
    setSaving(true);
    try {
      const created = await api.groups.createChat(group.id, { name: form.name.trim(), url: form.url });
      setItems(prev => prev ? [...prev, created] : [created]);
      setForm({ name: "", url: "" });
      setShowForm(false);
      addToast("success", t("groups.manage.chat_added"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.chat_error"));
    } finally { setSaving(false); }
  };

  const remove = async (c: GroupChatLink) => {
    if (!window.confirm(t("groups.manage.chat_delete_confirm", { name: c.name }))) return;
    const prev = items;
    setItems(cur => cur?.filter(x => x.id !== c.id) ?? null);
    try {
      await api.groups.deleteChat(group.id, c.id);
      addToast("success", t("groups.manage.chat_deleted"));
    } catch (e: unknown) {
      setItems(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.chat_error"));
    }
  };

  return (
    <PanelShell help={t("groups.manage.chats_help")} error={error} loading={items === null} onRetry={load}>
      {items?.map(c => (
        <div key={c.id} className="flex items-start gap-3 py-2 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-100">{c.name}</p>
            <p className="text-xs text-stone-500 truncate">{c.url}</p>
          </div>
          <Button size="xs" variant="danger" onClick={() => remove(c)} aria-label={t("groups.manage.chat_delete_confirm", { name: c.name })}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      {showForm ? (
        <div className="space-y-3 pt-2 border-t border-primary-100 dark:border-stone-800">
          <Input label={t("groups.manage.chat_name_label")} value={form.name} maxLength={100} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label={t("groups.manage.chat_url_label")} type="url" placeholder="https://chat.whatsapp.com/…" value={form.url} error={urlError}
            onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlError(undefined); }} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={add} disabled={saving || !form.name.trim() || !form.url} loading={saving}>{t("groups.manage.add_chat")}</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden /> {t("groups.manage.add_chat")}
        </Button>
      )}
    </PanelShell>
  );
}

// ── Gallery ─────────────────────────────────────────────────────────────────

function GalleryPanel({ group }: { group: Group }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const loader = useCallback(() => api.groups.gallery(group.id), [group.id]);
  const { items, setItems, error, load } = useCrudList<GroupGalleryItem>(loader);
  const [caption, setCaption] = useState("");
  const [showForm, setShowForm] = useState(false);

  const addFromUpload = async (urls: { large: string; original: string }) => {
    try {
      const created = await api.groups.createGalleryItem(group.id, {
        image_url: urls.large || urls.original, caption: caption || undefined,
      });
      setItems(prev => prev ? [created, ...prev] : [created]);
      setCaption("");
      setShowForm(false);
      addToast("success", t("groups.manage.photo_added"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.photo_error"));
    }
  };

  const remove = async (g: GroupGalleryItem) => {
    if (!window.confirm(t("groups.manage.photo_delete_confirm"))) return;
    const prev = items;
    setItems(cur => cur?.filter(x => x.id !== g.id) ?? null);
    try {
      await api.groups.deleteGalleryItem(group.id, g.id);
      addToast("success", t("groups.manage.photo_deleted"));
    } catch (e: unknown) {
      setItems(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.photo_error"));
    }
  };

  return (
    <PanelShell help={t("groups.manage.gallery_help")} error={error} loading={items === null} onRetry={load}>
      {items && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map(g => (
            <div key={g.id} className="relative group/photo aspect-square rounded-xl overflow-hidden border border-primary-100 dark:border-stone-800">
              <img src={safeImageUrl(g.image_url)} alt={g.caption || ""} className="w-full h-full object-cover" />
              <button
                onClick={() => remove(g)}
                aria-label={t("groups.manage.photo_delete_confirm")}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-stone-900/60 text-cream opacity-0 group-hover/photo:opacity-100 focus-visible:opacity-100 transition"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      {showForm ? (
        <div className="space-y-3 pt-2 border-t border-primary-100 dark:border-stone-800">
          <Input label={t("groups.manage.caption_label")} value={caption} maxLength={500} onChange={e => setCaption(e.target.value)} />
          <ImageUpload onUpload={addFromUpload} />
          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" aria-hidden /> {t("groups.manage.add_photo")}
        </Button>
      )}
    </PanelShell>
  );
}
