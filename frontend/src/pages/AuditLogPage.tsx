import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import Button from "../components/Button";
import Toast, { type ToastState } from "../components/Toast";
import { adminMe, listAudit, type AuditEntry } from "../api";
import { downloadFromUrl } from "../utils/csv";
import { resolveErrorMessage } from "../utils/errors";

function toLocal(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export default function AuditLogPage() {
  const nav = useNavigate();

  const [admin, setAdmin] = useState<string>("");
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function refresh(next?: Partial<{ page: number; pageSize: number }>) {
    setLoading(true);
    try {
      const resp = await listAudit({
        page: next?.page ?? page,
        pageSize: next?.pageSize ?? pageSize,
      });
      setItems(resp.items);
      setPage(resp.page);
      setPageSize(resp.pageSize);
      setPages(resp.pages);
      setTotal(resp.total);
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to load audit log") });
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
    const t = window.setTimeout(() => refresh({ page: 1 }), 100);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}-${end} of ${total}`;
  }, [total, page, pageSize]);

  async function exportCurrentPage() {
    await downloadFromUrl(`audit-page-${page}.csv`, `/api/admin/audit/export.csv`);
  }

  async function exportAll() {
    setToast({ kind: "idle" });
    setLoading(true);
    try {
      await downloadFromUrl("audit-all.csv", `/api/admin/audit/export.csv`);
      setToast({ kind: "ok", msg: "Exported audit CSV" });
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Export failed") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title="Audit log"
      subtitle="Global audit trail for admin actions."
      leftBadge="Admin • Audit • History"
      rightTop={
        <>
          <a className="topLink" href="/admin">
            Users
          </a>
          <a className="topLink" href="/api/docs" target="_blank" rel="noreferrer">
            API Docs
          </a>
        </>
      }
    >
      <div className="panelXL">
        <div className="panelTop">
          <div>
            <div className="panelTitle">Audit Entries</div>
            <div className="panelSub">
              Signed in as <span className="mono">{admin || "admin"}</span> • Showing{" "}
              <span className="pill">{rangeLabel}</span>
            </div>
          </div>

          <div className="panelActions">
            <select
              className="chip"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>

            <button className="chip" type="button" disabled={loading} onClick={exportCurrentPage}>
              Export CSV (page)
            </button>
            <button
              className="chip"
              type="button"
              disabled={loading}
              onClick={exportAll}
              title="Fetches all pages and exports one CSV"
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
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>User</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{toLocal(i.at)}</td>
                  <td className="mono">{i.actor}</td>
                  <td className="mono">{i.action}</td>
                  <td className="mono">
                    {i.username} <span className="muted">({i.userId})</span>
                  </td>
                  <td className="mono">{i.from}</td>
                  <td className="mono">{i.to}</td>
                </tr>
              ))}

              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mutedCell">
                    No entries.
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
      </div>

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
