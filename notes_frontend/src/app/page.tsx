"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteListItem, Tag } from "@/lib/api";
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  listTags,
  updateNote,
} from "@/lib/api";

type LoadState = "idle" | "loading" | "error";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Home() {
  const [notesState, setNotesState] = useState<LoadState>("idle");
  const [tagsState, setTagsState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");

  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [note, setNote] = useState<Note | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const autosaveTimer = useRef<number | null>(null);
  const lastSavedRef = useRef<{ title: string; content: string; tags: string } | null>(null);

  const tagsFromDraft = useMemo(() => {
    return draftTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [draftTags]);

  async function refreshLists() {
    setNotesState("loading");
    setTagsState("loading");
    setSaveError(null);

    try {
      const [notesRes, tagsRes] = await Promise.all([
        listNotes({ q: search || undefined, tag: activeTag || undefined }),
        listTags(),
      ]);
      setNotes(notesRes.items);
      setTags(tagsRes.items);
      setNotesState("idle");
      setTagsState("idle");

      // Auto-select first note if none selected
      if (!selectedId && notesRes.items.length > 0) {
        setSelectedId(notesRes.items[0].id);
      }
    } catch (e: any) {
      setNotesState("error");
      setTagsState("error");
      setSaveError(e?.message || "Failed to load");
    }
  }

  async function loadNote(id: string) {
    setDetailState("loading");
    setSaveError(null);
    try {
      const n = await getNote(id);
      setNote(n);
      setDraftTitle(n.title);
      setDraftContent(n.content);
      setDraftTags(n.tags.map((t) => t.name).join(", "));
      lastSavedRef.current = {
        title: n.title,
        content: n.content,
        tags: n.tags.map((t) => t.name).join(", "),
      };
      setDetailState("idle");
    } catch (e: any) {
      setDetailState("error");
      setSaveError(e?.message || "Failed to load note");
    }
  }

  useEffect(() => {
    refreshLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeTag]);

  useEffect(() => {
    if (selectedId) loadNote(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function scheduleAutosave() {
    if (!note) return;
    setSaveError(null);

    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(async () => {
      const last = lastSavedRef.current;
      const current = { title: draftTitle, content: draftContent, tags: draftTags };

      // Skip if unchanged
      if (last && last.title === current.title && last.content === current.content && last.tags === current.tags) {
        return;
      }

      try {
        setSaving(true);
        const updated = await updateNote(note.id, {
          title: draftTitle,
          content: draftContent,
          content_format: note.content_format,
          tags: tagsFromDraft,
        });
        setNote(updated);
        lastSavedRef.current = current;
        setSaving(false);
        // Refresh sidebar (timestamps/order/tags)
        const notesRes = await listNotes({ q: search || undefined, tag: activeTag || undefined });
        setNotes(notesRes.items);
      } catch (e: any) {
        setSaving(false);
        setSaveError(e?.message || "Autosave failed");
      }
    }, 650);
  }

  async function onNewNote() {
    setSaveError(null);
    try {
      const created = await createNote({
        title: "Untitled",
        content: "",
        content_format: "markdown",
        is_pinned: false,
        is_favorite: false,
        tags: [],
      });
      await refreshLists();
      setSelectedId(created.id);
    } catch (e: any) {
      setSaveError(e?.message || "Failed to create note");
    }
  }

  async function onDeleteSelected() {
    if (!selectedId) return;
    const ok = window.confirm("Delete this note? This cannot be undone.");
    if (!ok) return;

    setSaveError(null);
    try {
      await deleteNote(selectedId);
      setSelectedId(null);
      setNote(null);
      setDraftTitle("");
      setDraftContent("");
      setDraftTags("");
      await refreshLists();
    } catch (e: any) {
      setSaveError(e?.message || "Failed to delete note");
    }
  }

  async function toggleFlag(flag: "is_pinned" | "is_favorite") {
    if (!note) return;
    setSaveError(null);
    try {
      const updated = await updateNote(note.id, { [flag]: !note[flag] } as any);
      setNote(updated);
      await refreshLists();
    } catch (e: any) {
      setSaveError(e?.message || "Update failed");
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* Top bar */}
        <header className="nm-card px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(6,182,212,0.18))",
                border: "1px solid var(--nm-border)",
              }}
            />
            <div>
              <div className="text-[15px] font-semibold">NoteMaster</div>
              <div className="text-[12px]" style={{ color: "var(--nm-muted)" }}>
                Notes • Tags • Search • Autosave
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end w-full sm:w-auto">
            <input
              className="nm-input"
              placeholder="Search notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search notes"
            />
            <div className="flex gap-2">
              <button className="nm-btn nm-btnPrimary" onClick={onNewNote}>
                New
              </button>
              <button className="nm-btn" onClick={onDeleteSelected} disabled={!selectedId}>
                Delete
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside className="md:col-span-4 nm-card p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="text-[13px] font-semibold">Notes</div>
              <div className="text-[12px]" style={{ color: "var(--nm-muted)" }}>
                {notes.length}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 px-1 pb-3">
              <button
                className="nm-pill"
                onClick={() => setActiveTag(null)}
                style={{
                  borderColor: activeTag === null ? "var(--nm-primary)" : "var(--nm-border)",
                  color: activeTag === null ? "var(--nm-primary)" : "var(--nm-muted)",
                }}
              >
                All tags
              </button>
              {tagsState === "loading" ? (
                <span className="nm-pill">Loading tags…</span>
              ) : (
                tags.slice(0, 12).map((t) => (
                  <button
                    key={t.id}
                    className="nm-pill"
                    onClick={() => setActiveTag(t.name)}
                    style={{
                      borderColor: activeTag === t.name ? "var(--nm-success)" : "var(--nm-border)",
                      color: activeTag === t.name ? "var(--nm-success)" : "var(--nm-muted)",
                    }}
                  >
                    {t.name}
                  </button>
                ))
              )}
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {notesState === "loading" ? (
                <div className="text-sm px-2 py-6" style={{ color: "var(--nm-muted)" }}>
                  Loading notes…
                </div>
              ) : notesState === "error" ? (
                <div className="text-sm px-2 py-6" style={{ color: "var(--nm-muted)" }}>
                  Failed to load notes.
                </div>
              ) : notes.length === 0 ? (
                <div className="text-sm px-2 py-6" style={{ color: "var(--nm-muted)" }}>
                  No notes found. Create one with <b>New</b>.
                </div>
              ) : (
                notes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelectedId(n.id)}
                    className="w-full text-left nm-card px-3 py-3"
                    style={{
                      borderColor: n.id === selectedId ? "var(--nm-primary)" : "var(--nm-border)",
                      background: n.id === selectedId ? "rgba(59,130,246,0.06)" : "var(--nm-surface)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[14px] font-medium line-clamp-1">{n.title || "Untitled"}</div>
                      <div className="flex gap-1">
                        {n.is_pinned && <span title="Pinned">📌</span>}
                        {n.is_favorite && <span title="Favorite">★</span>}
                      </div>
                    </div>
                    <div className="mt-1 text-[12px]" style={{ color: "var(--nm-muted)" }}>
                      Updated {formatTime(n.updated_at)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {n.tags.slice(0, 4).map((t) => (
                        <span key={t} className="nm-pill">
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Editor */}
          <section className="md:col-span-8 nm-card p-4">
            {!selectedId ? (
              <div className="text-sm py-12 text-center" style={{ color: "var(--nm-muted)" }}>
                Select a note from the sidebar.
              </div>
            ) : detailState === "loading" ? (
              <div className="text-sm py-12 text-center" style={{ color: "var(--nm-muted)" }}>
                Loading note…
              </div>
            ) : detailState === "error" ? (
              <div className="text-sm py-12 text-center" style={{ color: "var(--nm-muted)" }}>
                Failed to load note.
              </div>
            ) : note ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1">
                    <input
                      className="nm-input"
                      value={draftTitle}
                      onChange={(e) => {
                        setDraftTitle(e.target.value);
                        scheduleAutosave();
                      }}
                      placeholder="Title"
                      aria-label="Note title"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button className="nm-btn" onClick={() => toggleFlag("is_pinned")}>
                      {note.is_pinned ? "Unpin" : "Pin"}
                    </button>
                    <button className="nm-btn" onClick={() => toggleFlag("is_favorite")}>
                      {note.is_favorite ? "Unfavorite" : "Favorite"}
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-[12px]" style={{ color: "var(--nm-muted)" }}>
                    Tags (comma-separated)
                  </label>
                  <input
                    className="nm-input mt-1"
                    value={draftTags}
                    onChange={(e) => {
                      setDraftTags(e.target.value);
                      scheduleAutosave();
                    }}
                    placeholder="e.g. work, ideas, project-x"
                    aria-label="Note tags"
                  />
                </div>

                <div className="mt-3">
                  <textarea
                    className="nm-textarea"
                    value={draftContent}
                    onChange={(e) => {
                      setDraftContent(e.target.value);
                      scheduleAutosave();
                    }}
                    placeholder="Write your note in Markdown…"
                    aria-label="Note content"
                  />
                </div>

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-[12px]" style={{ color: "var(--nm-muted)" }}>
                    {saving ? (
                      <span>Saving…</span>
                    ) : (
                      <span>Saved • Updated {formatTime(note.updated_at)}</span>
                    )}
                    {saveError ? (
                      <span style={{ color: "#EF4444" }}> • {saveError}</span>
                    ) : null}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--nm-muted)" }}>
                    Format: <b>{note.content_format}</b>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>

        {saveError ? (
          <div className="mt-4 nm-card px-4 py-3 text-sm" style={{ borderColor: "#fecaca", background: "#fff1f2" }}>
            {saveError}
          </div>
        ) : null}
      </div>
    </main>
  );
}
