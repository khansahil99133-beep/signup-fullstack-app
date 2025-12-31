import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import TextField from "../components/TextField";
import Button from "../components/Button";
import TextareaField from "../components/TextareaField";
import Toast, { type ToastState } from "../components/Toast";
import { downloadTextFile, toCsv } from "../utils/csv";
import { resolveErrorMessage } from "../utils/errors";

import {
  adminCreateBlog,
  adminDeleteBlog,
  adminListBlog,
  adminLogout,
  adminMe,
  adminUpdateBlog,
  adminUpdateUser,
  adminDeleteUser,
  createResetToken,
  listUsers,
  updateUserStatus,
  type BlogPost,
  type SignupUser,
  type UserStatus,
  type StatusHistoryEntry,
} from "../api";

type SortMode = "newest" | "oldest";
type StatusFilter = "" | UserStatus;

function toLocal(ts: string | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

function statusLabel(s: UserStatus): string {
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

function HistoryModal(props: { user: SignupUser; onClose: () => void }) {
  const rows: StatusHistoryEntry[] = Array.isArray(props.user.statusHistory)
    ? [...props.user.statusHistory].reverse()
    : [];

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHead">
          <div>
            <div className="modalTitle">Status history</div>
            <div className="modalSub">
              <span className="mono">{props.user.username}</span> •{" "}
              <span className="mono">{props.user.id}</span>
            </div>
          </div>
          <button className="miniBtn" type="button" onClick={props.onClose}>
            Close
          </button>
        </div>

        <div className="modalBody">
          {rows.length === 0 ? (
            <div className="mutedCell">No history yet.</div>
          ) : (
            <table className="table tableMini">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>By</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.at}-${i}`}>
                    <td className="mono">{toLocal(r.at)}</td>
                    <td className="mono">{r.by}</td>
                    <td className="mono">{r.from ?? "-"}</td>
                    <td className="mono">{r.to}</td>
                    <td className="mono">{r.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const nav = useNavigate();
  const [admin, setAdmin] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"signups" | "blog">("signups");

  const [users, setUsers] = useState<SignupUser[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<ToastState>({ kind: "idle" });

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [filter, setFilter] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const [busyId, setBusyId] = useState<string>("");
  const [historyUser, setHistoryUser] = useState<SignupUser | null>(null);
  const [editingUser, setEditingUser] = useState<SignupUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editTelegram, setEditTelegram] = useState("");
  const [editStatus, setEditStatus] = useState<UserStatus>("pending");
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [blogCoverUrl, setBlogCoverUrl] = useState("");
  const [blogTags, setBlogTags] = useState("");
  const [blogPublished, setBlogPublished] = useState(false);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogNewsletter, setBlogNewsletter] = useState(false);
  const [blogPage, setBlogPage] = useState(1);
  const [blogPages, setBlogPages] = useState(1);
  const [blogPageSize, setBlogPageSize] = useState(6);
  const [blogSort, setBlogSort] = useState<"newest" | "oldest">("newest");
  const [blogStatusFilter, setBlogStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [blogItems, setBlogItems] = useState<BlogPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogBusyId, setBlogBusyId] = useState("");
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);

  async function refresh(next?: Partial<{ page: number }>) {
    setLoading(true);
    try {
      const resp = await listUsers({
        q,
        status: filter || "",
        sort,
        page: next?.page ?? page,
        pageSize,
      });

      setUsers(resp.users);
      setCounts(resp.counts);
      setTotal(resp.total);
      setPages(resp.pages);
      setPage(resp.page);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to load users") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    async function boot() {
      setLoading(true);
      try {
        const me = await adminMe();
        if (!alive) return;
        setAdmin(me.admin.username);
        await refresh({ page: 1 });
      } catch {
        if (!alive) return;
        nav("/admin/login");
      } finally {
        if (alive) setLoading(false);
      }
    }
    boot();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      refresh({ page: 1 });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, filter, pageSize]);

  async function onLogout() {
    await adminLogout().catch(() => {});
    nav("/admin/login");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ kind: "ok", msg: "Copied" });
    } catch {
      setToast({ kind: "err", msg: "Copy failed" });
    }
  }

  async function setStatus(user: SignupUser, status: UserStatus) {
    setToast({ kind: "idle" });
    setBusyId(user.id);
    try {
      const res = await updateUserStatus(user.id, status);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.user : u)));
      setToast({ kind: "ok", msg: `Status: ${statusLabel(status)}` });
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to update") });
    } finally {
      setBusyId("");
    }
  }

  async function makeResetLink(user: SignupUser) {
    setToast({ kind: "idle" });
    setBusyId(user.id);
    try {
      const r = await createResetToken(user.id);
      await copy(`${window.location.origin}${r.resetUrl}`);
      setToast({ kind: "ok", msg: "Reset link copied (valid ~15 min)" });
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to create reset link") });
    } finally {
      setBusyId("");
    }
  }

  function openUserEditor(user: SignupUser) {
    setEditingUser(user);
    setEditEmail(user.email ?? "");
    setEditMobile(user.mobileNumber);
    setEditWhatsapp(user.whatsappNumber ?? "");
    setEditTelegram(user.telegramUsername ?? "");
    setEditStatus((user.status ?? "pending") as UserStatus);
  }

  function closeUserEditor() {
    setEditingUser(null);
    setEditEmail("");
    setEditMobile("");
    setEditWhatsapp("");
    setEditTelegram("");
    setEditStatus("pending");
  }

  async function saveUserEdits() {
    if (!editingUser) return;
    const mobile = editMobile.trim();
    if (!mobile) {
      setToast({ kind: "err", msg: "Mobile number is required" });
      return;
    }
    setToast({ kind: "idle" });
    setBusyId(editingUser.id);
    setEditUserSaving(true);
    try {
      const resp = await adminUpdateUser(editingUser.id, {
        email: editEmail.trim(),
        mobileNumber: mobile,
        whatsappNumber: editWhatsapp.trim(),
        telegramUsername: editTelegram.trim(),
        status: editStatus,
      });
      setUsers((prev) => prev.map((u) => (u.id === resp.user.id ? resp.user : u)));
      setToast({ kind: "ok", msg: "User updated" });
      closeUserEditor();
      await refresh({ page });
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to update user") });
    } finally {
      setEditUserSaving(false);
      setBusyId("");
    }
  }

  async function deleteUser(user: SignupUser) {
    if (!window.confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    setToast({ kind: "idle" });
    setBusyId(user.id);
    try {
      await adminDeleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (editingUser?.id === user.id) closeUserEditor();
      setToast({ kind: "ok", msg: "User deleted" });
      await refresh({ page });
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to delete user") });
    } finally {
      setBusyId("");
    }
  }

  function resetBlogForm() {
    setBlogTitle("");
    setBlogExcerpt("");
    setBlogContent("");
    setBlogCoverUrl("");
    setBlogTags("");
    setBlogPublished(false);
    setBlogNewsletter(false);
    setEditingBlog(null);
  }

  async function saveBlogPost() {
    setToast({ kind: "idle" });
    if (!blogTitle.trim()) {
      setToast({ kind: "err", msg: "Title is required" });
      return;
    }
    if (!blogContent.trim()) {
      setToast({ kind: "err", msg: "Content is required" });
      return;
    }
    setBlogSaving(true);
    setBlogBusyId(editingBlog?.id ?? "");
    const tags = blogTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      title: blogTitle.trim(),
      excerpt: blogExcerpt.trim() || undefined,
      contentMarkdown: blogContent,
      coverImageUrl: blogCoverUrl.trim() || undefined,
      tags: tags.length ? tags : undefined,
      published: blogPublished,
      newsletter: blogNewsletter,
    };
    try {
      if (editingBlog) {
        await adminUpdateBlog(editingBlog.id, payload);
        setToast({ kind: "ok", msg: "Blog post updated" });
      } else {
        await adminCreateBlog(payload);
        setToast({ kind: "ok", msg: `Blog post ${blogPublished ? "published" : "saved"}` });
      }
      resetBlogForm();
      await fetchBlogList(blogPage);
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to save post") });
    } finally {
      setBlogSaving(false);
      setBlogBusyId("");
    }
  }

  function startBlogEdit(post: BlogPost) {
    setEditingBlog(post);
    setBlogTitle(post.title);
    setBlogExcerpt(post.excerpt || "");
    setBlogContent(post.contentMarkdown || "");
    setBlogCoverUrl(post.coverImageUrl || "");
    setBlogTags(Array.isArray(post.tags) ? post.tags.join(", ") : "");
    setBlogPublished(Boolean(post.published));
    setBlogNewsletter(Boolean(post.newsletterRequested));
  }

  async function deleteBlogPost(post: BlogPost) {
    if (!window.confirm(`Delete blog post "${post.title}"?`)) return;
    setToast({ kind: "idle" });
    setBlogBusyId(post.id);
    try {
      await adminDeleteBlog(post.id);
      if (editingBlog?.id === post.id) resetBlogForm();
      setToast({ kind: "ok", msg: "Blog post removed" });
      const targetPage = blogItems.length === 1 && blogPage > 1 ? blogPage - 1 : blogPage;
      await fetchBlogList(targetPage);
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to delete blog post") });
    } finally {
      setBlogBusyId("");
    }
  }

  const fetchBlogList = useCallback(
    async (pageToLoad: number) => {
      setBlogLoading(true);
      try {
        const resp = await adminListBlog({
          page: pageToLoad,
          pageSize: blogPageSize,
          sort: blogSort,
          status: blogStatusFilter,
        });
        setBlogItems(resp.items);
        setBlogTotal(resp.total);
        setBlogPages(resp.pages);
        setBlogPage(resp.page);
      } catch (err) {
        setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to load blog posts") });
      } finally {
        setBlogLoading(false);
      }
    },
    [blogPageSize, blogSort, blogStatusFilter],
  );

  useEffect(() => {
    if (activeTab !== "blog") return;
    fetchBlogList(1);
  }, [activeTab, fetchBlogList]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}-${end} of ${total}`;
  }, [total, page, pageSize]);

  const blogRangeLabel = useMemo(() => {
    if (blogTotal === 0) return "0";
    const start = (blogPage - 1) * blogPageSize + 1;
    const end = Math.min(blogPage * blogPageSize, blogTotal);
    return `${start}-${end} of ${blogTotal}`;
  }, [blogPage, blogPageSize, blogTotal]);

  function exportCurrentPageUsers() {
    const rows = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email ?? "",
      mobileNumber: u.mobileNumber,
      whatsappNumber: u.whatsappNumber ?? "",
      telegramUsername: u.telegramUsername ?? "",
      status: u.status ?? "pending",
      statusChangedBy: u.statusChangedBy ?? "",
      statusChangedAt: u.statusChangedAt ?? "",
      createdAt: u.createdAt,
    }));
    const csv = toCsv(rows, [
      "id",
      "username",
      "email",
      "mobileNumber",
      "whatsappNumber",
      "telegramUsername",
      "status",
      "statusChangedBy",
      "statusChangedAt",
      "createdAt",
    ]);
    downloadTextFile(`users-page-${page}.csv`, csv);
  }

  async function exportAllFilteredUsers() {
    setToast({ kind: "idle" });
    setLoading(true);
    try {
      const all: SignupUser[] = [];
      let p = 1;
      let pages = 1;
      while (p <= pages) {
        const resp = await listUsers({ q, status: filter || "", sort, page: p, pageSize: 100 });
        all.push(...resp.users);
        pages = resp.pages;
        p += 1;
      }

      const rows = all.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email ?? "",
        mobileNumber: u.mobileNumber,
        whatsappNumber: u.whatsappNumber ?? "",
        telegramUsername: u.telegramUsername ?? "",
        status: u.status ?? "pending",
        statusChangedBy: u.statusChangedBy ?? "",
        statusChangedAt: u.statusChangedAt ?? "",
        createdAt: u.createdAt,
      }));

      const csv = toCsv(rows, [
        "id",
        "username",
        "email",
        "mobileNumber",
        "whatsappNumber",
        "telegramUsername",
        "status",
        "statusChangedBy",
        "statusChangedAt",
        "createdAt",
      ]);

      downloadTextFile("users-all-filtered.csv", csv);
      setToast({ kind: "ok", msg: `Exported ${all.length} rows` });
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Export failed") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title="Admin dashboard"
      subtitle="Server-side search + pagination. Approve/reject with audit history."
      leftBadge="Admin • Approvals • Audit"
      noHero
      rightTop={
        <>
          <a className="topLink" href="/admin/audit">
            Audit
          </a>
          <a className="topLink" href="/api/docs" target="_blank" rel="noreferrer">
            API Docs
          </a>
          <Button variant="ghost" onClick={onLogout}>
            Logout
          </Button>
        </>
      }
    >
      <div className="panelXL">
        <div className="adminTabBar">
          <button
            type="button"
            className={`adminTabBtn ${activeTab === "signups" ? "active" : ""}`}
            onClick={() => setActiveTab("signups")}
          >
            New Signups
          </button>
          <button
            type="button"
            className={`adminTabBtn ${activeTab === "blog" ? "active" : ""}`}
            onClick={() => setActiveTab("blog")}
          >
            Blog editor
          </button>
        </div>
        {activeTab === "signups" && (
          <>
            <div className="panelTop">
              <div>
                <div className="panelTitle">New Signups</div>
                <div className="panelSub">
                  Signed in as <span className="mono">{admin || "admin"}</span> • Showing{" "}
                  <span className="pill">{rangeLabel}</span>
                  {lastRefresh ? (
                    <>
                      {" "}
                      • Refreshed <span className="mono">{lastRefresh}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="panelActions">
                <input
                  className="search"
                  placeholder="Search username, mobile, telegram, email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />

                <button
                  className={`chip ${filter === "" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setFilter("")}
                >
                  All{" "}
                  <span className="chipCount">
                    {counts.pending + counts.approved + counts.rejected}
                  </span>
                </button>

                <button
                  className={`chip ${filter === "pending" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setFilter("pending")}
                >
                  Pending <span className="chipCount">{counts.pending}</span>
                </button>

                <button
                  className={`chip ${filter === "approved" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setFilter("approved")}
                >
                  Approved <span className="chipCount">{counts.approved}</span>
                </button>

                <button
                  className={`chip ${filter === "rejected" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setFilter("rejected")}
                >
                  Rejected <span className="chipCount">{counts.rejected}</span>
                </button>

                <button
                  className="chip"
                  type="button"
                  onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
                >
                  Sort: {sort === "newest" ? "Newest" : "Oldest"}
                </button>

                <select
                  className="chip"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>

                <button
                  className="chip"
                  type="button"
                  disabled={loading}
                  onClick={exportCurrentPageUsers}
                >
                  Export CSV (page)
                </button>
                <button
                  className="chip"
                  type="button"
                  disabled={loading}
                  onClick={exportAllFilteredUsers}
                  title="Fetches all pages for current filters and exports one CSV"
                >
                  Export CSV (all)
                </button>
                <Button onClick={() => refresh()}>{loading ? "Loading..." : "Refresh"}</Button>
              </div>
            </div>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Status by</th>
                    <th>Status time</th>
                    <th>Created</th>
                    <th>Username</th>
                    <th>Mobile</th>
                    <th>WhatsApp</th>
                    <th>Telegram</th>
                    <th>Email</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const st = (u.status ?? "pending") as UserStatus;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <span className={`badge badge-${st}`}>{statusLabel(st)}</span>
                        </td>
                        <td className="mono">{u.statusChangedBy ?? "-"}</td>
                        <td className="mono">{toLocal(u.statusChangedAt)}</td>
                        <td className="mono">{toLocal(u.createdAt)}</td>
                        <td className="strong">{u.username}</td>
                        <td className="mono">{u.mobileNumber}</td>
                        <td className="mono">{u.whatsappNumber ?? "-"}</td>
                        <td className="mono">{u.telegramUsername ?? "-"}</td>
                        <td className="mono">{u.email ?? "-"}</td>
                        <td className="actionsCell">
                          <div className="rowBtns">
                            <button
                              className="miniChip"
                              type="button"
                              onClick={() => copy(u.mobileNumber)}
                            >
                              Copy mobile
                            </button>
                            <button
                              className="miniChip"
                              type="button"
                              onClick={() => setHistoryUser(u)}
                            >
                              History
                            </button>
                            <button
                              className="miniChip"
                              type="button"
                              disabled={busy}
                              onClick={() => makeResetLink(u)}
                              title="Generate one-time reset link"
                            >
                              {busy ? "..." : "Reset link"}
                            </button>
                            <button
                              className="miniChip"
                              type="button"
                              onClick={() => openUserEditor(u)}
                            >
                              Edit
                            </button>
                            <button
                              className="miniChip miniReject"
                              type="button"
                              disabled={busy}
                              onClick={() => deleteUser(u)}
                            >
                              Delete
                            </button>

                            {st === "pending" ? (
                              <>
                                <button
                                  className="miniChip miniApprove"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setStatus(u, "approved")}
                                >
                                  {busy ? "..." : "Approve"}
                                </button>
                                <button
                                  className="miniChip miniReject"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setStatus(u, "rejected")}
                                >
                                  {busy ? "..." : "Reject"}
                                </button>
                              </>
                            ) : (
                              <button
                                className="miniChip"
                                type="button"
                                disabled={busy}
                                onClick={() => setStatus(u, "pending")}
                                title="Move back to pending"
                              >
                                {busy ? "..." : "Undo"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="mutedCell">
                        No matches.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <div className="muted">
                Page <span className="mono">{page}</span> / <span className="mono">{pages}</span>
              </div>
              <div className="pagerBtns">
                <button
                  className="chip"
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => refresh({ page: page - 1 })}
                >
                  Prev
                </button>
                <button
                  className="chip"
                  type="button"
                  disabled={page >= pages || loading}
                  onClick={() => refresh({ page: page + 1 })}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "blog" && (
          <>
            <div className="panelBlogCard">
              <div className="panelBlogHead">
                <div>
                  <div className="panelBlogTitle">
                    {editingBlog ? "Edit blog update" : "Share a blog update"}
                  </div>
                  <div className="panelBlogSub">
                    {editingBlog
                      ? `Editing ${editingBlog.title}`
                      : "Drafts + published posts live under /admin/blog."}
                  </div>
                </div>
                <button className="miniBtn" type="button" onClick={resetBlogForm}>
                  {editingBlog ? "Cancel edit" : "Clear"}
                </button>
              </div>

              <div className="panelBlogFields">
                <TextField
                  label="Title"
                  placeholder="Blog post title"
                  value={blogTitle}
                  onChange={setBlogTitle}
                />
                <TextField
                  label="Excerpt (optional)"
                  placeholder="Short summary"
                  value={blogExcerpt}
                  onChange={setBlogExcerpt}
                />
                <TextField
                  label="Cover image URL (optional)"
                  placeholder="https://..."
                  value={blogCoverUrl}
                  onChange={setBlogCoverUrl}
                />
                <TextField
                  label="Tags (comma separated)"
                  placeholder="events, updates"
                  value={blogTags}
                  onChange={setBlogTags}
                />
                <TextareaField
                  label="Content (markdown)"
                  placeholder="Write the blog content here..."
                  value={blogContent}
                  onChange={setBlogContent}
                  rows={6}
                />
              </div>

              <div className="panelBlogFooter">
                <label className="panelBlogToggle">
                  <input
                    type="checkbox"
                    checked={blogPublished}
                    onChange={(e) => setBlogPublished(e.target.checked)}
                  />
                  Publish immediately
                </label>
                <label className="panelBlogToggle">
                  <input
                    type="checkbox"
                    checked={blogNewsletter}
                    onChange={(e) => setBlogNewsletter(e.target.checked)}
                  />
                  Queue newsletter
                </label>
                <Button onClick={saveBlogPost} disabled={blogSaving}>
                  {blogSaving ? "Saving..." : editingBlog ? "Update blog post" : "Create blog post"}
                </Button>
              </div>
            </div>

            <div className="panelBlogList">
              <div className="panelBlogListActions">
                <div className="muted">
                  Showing <span className="mono">{blogRangeLabel}</span>
                </div>
                <button
                  className={`chip ${blogStatusFilter === "all" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setBlogStatusFilter("all")}
                >
                  All
                </button>
                <button
                  className={`chip ${blogStatusFilter === "published" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setBlogStatusFilter("published")}
                >
                  Published
                </button>
                <button
                  className={`chip ${blogStatusFilter === "draft" ? "chipOn" : ""}`}
                  type="button"
                  onClick={() => setBlogStatusFilter("draft")}
                >
                  Draft
                </button>
                <select
                  className="chip"
                  value={blogPageSize}
                  onChange={(e) => setBlogPageSize(Number(e.target.value))}
                >
                  <option value={6}>6 / page</option>
                  <option value={12}>12 / page</option>
                  <option value={24}>24 / page</option>
                </select>
                <select
                  className="chip"
                  value={blogSort}
                  onChange={(e) => setBlogSort(e.target.value as "newest" | "oldest")}
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                </select>
                <Button onClick={() => fetchBlogList(blogPage)} disabled={blogLoading}>
                  {blogLoading ? "Loading..." : "Refresh list"}
                </Button>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Title</th>
                      <th>Created</th>
                      <th>Published</th>
                      <th>Tags</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blogLoading ? (
                      <tr>
                        <td colSpan={6} className="mutedCell">
                          Loading...
                        </td>
                      </tr>
                    ) : blogItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="mutedCell">
                          No posts yet.
                        </td>
                      </tr>
                    ) : (
                      blogItems.map((post) => (
                        <tr key={post.id}>
                          <td>
                            <span
                              className={`badge badge-${post.published ? "approved" : "pending"}`}
                            >
                              {post.published ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td>
                            <Link
                              className="link"
                              to={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {post.title}
                            </Link>
                            {post.excerpt ? <div className="muted">{post.excerpt}</div> : null}
                          </td>
                          <td className="mono">{toLocal(post.createdAt)}</td>
                          <td className="mono">
                            {post.publishedAt ? toLocal(post.publishedAt) : "-"}
                          </td>
                          <td className="muted">
                            {post.tags && post.tags.length > 0 ? post.tags.join(", ") : "-"}
                          </td>
                          <td className="actionsCell">
                            <div className="rowBtns">
                              <button
                                className="miniChip"
                                type="button"
                                disabled={blogBusyId === post.id}
                                onClick={() => startBlogEdit(post)}
                              >
                                Edit
                              </button>
                              <button
                                className="miniChip miniReject"
                                type="button"
                                disabled={blogBusyId === post.id}
                                onClick={() => deleteBlogPost(post)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pager">
                <div className="muted">
                  Page <span className="mono">{blogPage}</span> /{" "}
                  <span className="mono">{blogPages}</span>
                </div>
                <div className="pagerBtns">
                  <button
                    className="chip"
                    type="button"
                    disabled={blogPage <= 1 || blogLoading}
                    onClick={() => fetchBlogList(blogPage - 1)}
                  >
                    Prev
                  </button>
                  <button
                    className="chip"
                    type="button"
                    disabled={blogPage >= blogPages || blogLoading}
                    onClick={() => fetchBlogList(blogPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="panelFoot">
          <div className="muted">Passwords are hashed; use reset link if needed.</div>
          <div className="muted">
            <span className="mono">GET /api/admin/users</span> •{" "}
            <span className="mono">PATCH /api/admin/users/:id</span> •{" "}
            <span className="mono">GET /api/admin/audit</span>
          </div>
        </div>
      </div>

      {editingUser ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modalHead">
              <div>
                <div className="modalTitle">Edit user</div>
                <div className="modalSub">
                  <span className="mono">{editingUser.username}</span> ƒ?›{" "}
                  <span className="mono">{editingUser.id}</span>
                </div>
              </div>
              <button className="miniBtn" type="button" onClick={closeUserEditor}>
                Close
              </button>
            </div>
            <div className="modalBody">
              <div className="modalForm">
                <TextField
                  label="Email (optional)"
                  placeholder="user@example.com"
                  value={editEmail}
                  onChange={setEditEmail}
                />
                <TextField
                  label="Mobile number"
                  placeholder="+91 555 555 5555"
                  value={editMobile}
                  onChange={setEditMobile}
                />
                <TextField
                  label="WhatsApp number (optional)"
                  placeholder="+91 555 555 5555"
                  value={editWhatsapp}
                  onChange={setEditWhatsapp}
                />
                <TextField
                  label="Telegram username (optional)"
                  placeholder="@yourusername"
                  value={editTelegram}
                  onChange={setEditTelegram}
                />
                <label className="field" htmlFor="edit-status" aria-label="Status">
                  <div className="fieldLabelRow">
                    <div className="fieldLabel">Status</div>
                  </div>
                  <div className="fieldRow">
                    <select
                      id="edit-status"
                      className="fieldInput"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </label>
                <div className="modalActions">
                  <Button onClick={saveUserEdits} disabled={editUserSaving}>
                    {editUserSaving ? "Saving..." : "Save changes"}
                  </Button>
                  <button className="miniBtn" type="button" onClick={closeUserEditor}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {historyUser ? (
        <HistoryModal user={historyUser} onClose={() => setHistoryUser(null)} />
      ) : null}

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
