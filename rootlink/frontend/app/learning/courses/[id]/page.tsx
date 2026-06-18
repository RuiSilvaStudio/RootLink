"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, CheckCircle, PlayCircle, ChevronDown, ChevronUp, Edit, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useLocale } from "@/lib/locale-context";

export default function CourseDetailPage() {
  const { t } = useLocale();
  const params = useParams();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<number | null>(null);
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [editLessonId, setEditLessonId] = useState<number | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: "", body: "", video_url: "", order: 1 });
  const [savingLesson, setSavingLesson] = useState(false);

  const fetchData = async () => {
    const id = Number(params.id);
    const [c, l, e] = await Promise.all([
      api.learning.courses.get(id),
      api.learning.courses.lessons.list(id),
      user ? api.learning.myEnrollments().then((el) => el.find((enr: any) => enr.course_id === id)).catch(() => null) : Promise.resolve(null),
    ]);
    setCourse(c);
    setLessons(l);
    setEnrollment(e);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) api.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [params.id, user]);

  const handleEnroll = async () => {
    try {
      const enr = await api.learning.courses.enroll(course.id);
      setEnrollment(enr);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMarkComplete = async (lessonId: number) => {
    await api.learning.courses.lessons.markComplete(lessonId);
    const enr = await api.learning.myEnrollments().then((el) => el.find((en: any) => en.course_id === course.id));
    setEnrollment(enr);
  };

  const canEdit = user && (user.role === "admin" || user.role === "moderator" || course?.created_by === user?.id);

  const resetLessonForm = () => setLessonForm({ title: "", body: "", video_url: "", order: lessons.length + 1 });

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLesson(true);
    try {
      await api.learning.courses.lessons.create(Number(params.id), lessonForm);
      resetLessonForm();
      setShowNewLesson(false);
      const updated = await api.learning.courses.lessons.list(Number(params.id));
      setLessons(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingLesson(false);
    }
  };

  const handleEditLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLesson(true);
    try {
      await api.learning.courses.lessons.update(editLessonId!, lessonForm);
      setEditLessonId(null);
      resetLessonForm();
      const updated = await api.learning.courses.lessons.list(Number(params.id));
      setLessons(updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!confirm(t("learning.delete_lesson_confirm"))) return;
    await api.learning.courses.lessons.delete(lessonId);
    const updated = await api.learning.courses.lessons.list(Number(params.id));
    setLessons(updated);
  };

  const openEditLesson = (lesson: any) => {
    setEditLessonId(lesson.id);
    setLessonForm({ title: lesson.title, body: lesson.body || "", video_url: lesson.video_url || "", order: lesson.order });
    setShowNewLesson(false);
  };

  if (loading) return <div className="text-center py-20 text-stone-500">{t("common.loading")}</div>;
  if (!course) return <div className="text-center py-20 text-stone-400">{t("learning.course_not_found")}</div>;

  const lessonProgress = enrollment?.lesson_progress || [];
  const doneCount = lessonProgress.filter((p: any) => p.completed).length;
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
  const canView = user && (course.published || canEdit);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: t("nav.learning"), href: "/learning" },
        { label: t("learning.course_title"), href: "/learning/courses" },
        { label: course.title }
      ]} />

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {course.image_url && <img src={course.image_url} alt="" loading="lazy" className="w-full h-48 object-cover rounded-xl mb-6" />}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold text-stone-800 font-serif">{course.title}</h1>
            {canEdit && (
              <Link href={`/learning/courses/${course.id}/edit`} className="flex items-center gap-1 text-sm bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-200 shrink-0">
                <Edit className="w-4 h-4" /> {t("learning.edit")}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-sm">
            {course.category && <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{t("learning.category_" + course.category)}</span>}
            {course.difficulty && <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{t("learning.option_" + course.difficulty)}</span>}
            {course.estimated_hours && <span className="flex items-center gap-1 text-stone-500"><Clock className="w-4 h-4" />{t("learning.hours", { hours: course.estimated_hours })}</span>}
            <span className="flex items-center gap-1 text-stone-500"><BookOpen className="w-4 h-4" />{t("learning.lessons_count", { count: totalLessons })}</span>
            <span className={`px-2 py-0.5 rounded ${course.published ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`}>
              {course.published ? t("learning.published") : t("learning.draft")}
            </span>
          </div>
          <p className="mt-4 text-stone-700 whitespace-pre-wrap">{course.description}</p>
        </div>

        <div>
          {!user && (
            <div className="bg-white p-5 rounded-xl border border-stone-200 mb-4">
              <p className="text-sm text-stone-500 text-center">
                <a href="/auth/login" className="text-primary-600 hover:underline font-medium">{t("learning.sign_in_to_enroll")}</a>
              </p>
            </div>
          )}
          {enrollment && (
            <div className="bg-white p-5 rounded-xl border border-stone-200 mb-4">
              <h3 className="font-semibold text-stone-700 mb-2">{t("learning.your_progress")}</h3>
              <div className="flex justify-between text-sm text-stone-500 mb-1">
                <span>{t("learning.lessons_progress", { done: doneCount, total: totalLessons })}</span>
                <span>{t("learning.percent", { pct: progressPct })}</span>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-2.5">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              {enrollment.completed && (
                <p className="flex items-center gap-1 text-sm text-green-600 mt-2"><CheckCircle className="w-4 h-4" /> {t("learning.completed_bang")}</p>
              )}
            </div>
          )}

          {user && !enrollment && canView && (
            <button onClick={handleEnroll} className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition font-medium mb-4">
              {t("learning.enroll")}
            </button>
          )}
          {!user && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
              <a href="/auth/login" className="font-medium hover:underline">{t("learning.sign_in_to_enroll_btn")}</a>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-stone-800 font-serif">{t("learning.lessons")}</h2>
          {canEdit && (
            <button onClick={() => { setShowNewLesson(!showNewLesson); setEditLessonId(null); resetLessonForm(); }} className="flex items-center gap-1 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700">
              <Plus className="w-4 h-4" /> {t("learning.add_lesson")}
            </button>
          )}
        </div>

        {showNewLesson && (
          <form onSubmit={handleCreateLesson} className="bg-primary-50 rounded-xl p-4 mb-4 border border-primary-200 space-y-3">
            <h3 className="font-semibold text-sm text-primary-800">{t("learning.new_lesson")}</h3>
            <input required placeholder={t("learning.lesson_title_placeholder")} value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} className="w-full border border-primary-300 rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder={t("learning.lesson_content_placeholder")} value={lessonForm.body} onChange={(e) => setLessonForm({ ...lessonForm, body: e.target.value })} rows={3} className="w-full border border-primary-300 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex gap-3">
              <input placeholder={t("learning.video_url_placeholder")} value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} className="flex-1 border border-primary-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" placeholder={t("learning.order_placeholder")} value={lessonForm.order} onChange={(e) => setLessonForm({ ...lessonForm, order: parseInt(e.target.value) || 1 })} className="w-20 border border-primary-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingLesson} className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">{savingLesson ? t("common.saving") : t("common.create")}</button>
              <button type="button" onClick={() => setShowNewLesson(false)} className="text-sm text-stone-500 px-3 py-1.5 hover:text-stone-700">{t("common.cancel")}</button>
            </div>
          </form>
        )}

        {editLessonId !== null && (
          <form onSubmit={handleEditLesson} className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-200 space-y-3">
            <h3 className="font-semibold text-sm text-amber-800">{t("learning.edit_lesson")}</h3>
            <input required placeholder={t("learning.lesson_title_placeholder")} value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder={t("learning.lesson_content_edit_placeholder")} value={lessonForm.body} onChange={(e) => setLessonForm({ ...lessonForm, body: e.target.value })} rows={3} className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex gap-3">
              <input placeholder={t("learning.video_url_edit_placeholder")} value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" placeholder={t("learning.order_placeholder")} value={lessonForm.order} onChange={(e) => setLessonForm({ ...lessonForm, order: parseInt(e.target.value) || 1 })} className="w-20 border border-amber-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingLesson} className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">{savingLesson ? t("common.saving") : t("common.save")}</button>
              <button type="button" onClick={() => setEditLessonId(null)} className="text-sm text-stone-500 px-3 py-1.5 hover:text-stone-700">{t("common.cancel")}</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {lessons.length === 0 ? (
            <p className="text-stone-400 py-4">{t("learning.no_lessons")}</p>
          ) : (
            lessons.map((lesson, idx) => {
              const completed = lessonProgress.find((p: any) => p.lesson_id === lesson.id)?.completed;
              const isActive = activeLesson === lesson.id;
              return (
                <div key={lesson.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  <div className="flex items-start">
                    <button
                      onClick={() => setActiveLesson(isActive ? null : lesson.id)}
                      className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-stone-50 transition"
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${completed ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {completed ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                      </span>
                      <div className="flex-1">
                        <span className="font-medium text-stone-800">{lesson.title}</span>
                        {lesson.video_url && <PlayCircle className="w-4 h-4 inline ml-2 text-primary-600" />}
                      </div>
                      {isActive ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </button>
                    {canEdit && (
                      <div className="flex gap-1 p-2 shrink-0">
                        <button onClick={() => openEditLesson(lesson)} className="p-1.5 text-stone-400 hover:text-primary-600 hover:bg-primary-50 rounded transition" title={t("learning.edit_lesson_btn")}>
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteLesson(lesson.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition" title={t("learning.delete_lesson")}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                      {user ? (
                        <>
                          <div className="prose prose-sm max-w-none text-stone-700 whitespace-pre-wrap">{lesson.body}</div>
                          {lesson.video_url && (
                            <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-primary-600 hover:underline text-sm">
                              <PlayCircle className="w-4 h-4" /> {t("learning.watch_video")}
                            </a>
                          )}
                          {enrollment && !completed && (
                            <button onClick={() => handleMarkComplete(lesson.id)} className="mt-3 bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition text-sm">
                              {t("learning.mark_complete")}
                            </button>
                          )}
                          {completed && (
                            <span className="inline-flex items-center gap-1 mt-3 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> {t("learning.lesson_completed")}</span>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-6 text-stone-500">
                          <p className="font-medium">{t("learning.lesson_locked")}</p>
                          <p className="mt-1 text-sm">
                            {t("learning.sign_in_to_access")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
