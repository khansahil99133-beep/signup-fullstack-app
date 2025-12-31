import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Shell from "../components/Shell";
import Button from "../components/Button";
import Toast, { type ToastState } from "../components/Toast";
import { listBlog, type BlogPost } from "../api";
import { setCanonical, setDocumentTitle, setMetaDescription, setTwitterTags } from "../utils/meta";
import { resolveErrorMessage } from "../utils/errors";

type SortMode = "newest" | "oldest";

function toLocal(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleDateString();
}

export default function BlogTagPage() {
  const { tag = "" } = useParams();
  const tagNorm = (tag || "").toLowerCase();

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");

  const [items, setItems] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  async function refresh(next?: Partial<{ page: number }>) {
    setLoading(true);
    try {
      const resp = await listBlog({ q, tag: tagNorm, sort, page: next?.page ?? page, pageSize });
      setItems(resp.items);
      setTotal(resp.total);
      setPages(resp.pages);
      setPage(resp.page);
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed to load blog") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setDocumentTitle(`#${tagNorm} • Blog`);
    setMetaDescription(`Posts tagged #${tagNorm}.`);
    setCanonical(`${window.location.origin}/blog/tag/${encodeURIComponent(tagNorm)}`);
    setTwitterTags({ title: `#${tagNorm} • Blog`, description: `Posts tagged #${tagNorm}.` });
  }, [tagNorm]);

  useEffect(() => {
    const t = window.setTimeout(() => refresh({ page: 1 }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, tagNorm]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}-${end} of ${total}`;
  }, [total, page, pageSize]);

  return (
    <Shell
      title={`#${tagNorm}`}
      subtitle="Tag page"
      leftBadge="Public • Blog • Tag"
      rightTop={
        <>
          <a className="topLink" href="/blog">
            All posts
          </a>
          <a className="topLink" href="/">
            Sign Up
          </a>
          <a className="topLink" href="/admin">
            Admin
          </a>
        </>
      }
    >
      <div className="panelXL">
        <div className="panelTop">
          <div>
            <div className="panelTitle">Tagged posts</div>
            <div className="panelSub">
              Showing <span className="pill">{rangeLabel}</span>
            </div>
          </div>

          <div className="panelActions">
            <input
              className="search"
              placeholder="Search within tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="chip"
              type="button"
              onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
            >
              Sort: {sort === "newest" ? "Newest" : "Oldest"}
            </button>
            <Button onClick={() => refresh()}>{loading ? "Loading..." : "Refresh"}</Button>
          </div>
        </div>

        <div className="blogGrid">
          {items.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="blogCard">
              {p.coverImageUrl ? (
                <img className="blogCover" src={p.coverImageUrl} alt="" />
              ) : (
                <div className="blogCover blogCoverEmpty" />
              )}
              <div className="blogCardBody">
                <div className="blogTitle">{p.title}</div>
                <div className="blogMeta">
                  <span className="mono">{toLocal(p.publishedAt || p.createdAt)}</span>
                  {p.tags?.length ? (
                    <span className="muted">
                      {" "}
                      •{" "}
                      {p.tags
                        .slice(0, 4)
                        .map((t) => `#${t}`)
                        .join(" ")}
                    </span>
                  ) : null}
                </div>
                <div className="blogExcerpt">{p.excerpt}</div>
              </div>
            </Link>
          ))}
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

        <div className="panelFoot">
          <div className="muted">
            RSS:{" "}
            <a className="link" href="/blog/rss.xml" target="_blank" rel="noreferrer">
              /blog/rss.xml
            </a>
          </div>
          <div className="muted">
            Sitemap:{" "}
            <a className="link" href="/blog/sitemap.xml" target="_blank" rel="noreferrer">
              /blog/sitemap.xml
            </a>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
