import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

export default function BlogListPage() {
  useEffect(() => {
    setDocumentTitle("Blog • Posts");
    setMetaDescription("Read the latest blog posts.");
    setCanonical(`${window.location.origin}/blog`);
    setTwitterTags({ title: "Blog • Posts", description: "Read the latest blog posts." });
  }, []);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
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
      const resp = await listBlog({ q, tag, sort, page: next?.page ?? page, pageSize });
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
    const t = window.setTimeout(() => refresh({ page: 1 }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tag, sort]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of items) for (const t of p.tags || []) s.add(t);
    return Array.from(s).slice(0, 12);
  }, [items]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}-${end} of ${total}`;
  }, [total, page, pageSize]);

  return (
    <Shell title="Blog" subtitle="Posts, updates, and guides." leftBadge="Public • Blog" noHero>
      <div className="blogListContent">
        <section className="blogListHero">
          <div className="blogListHeroCopy">
            <div className="blogHeroKicker">Insights & updates</div>
            <h1>Stories from the Sign UP Jeetwin team</h1>
            <p>
              Break down what we’ve learned about secure signups, reliable workflows, and keeping
              fans informed with the latest product and trusted automation content.
            </p>
            <div className="blogListHeroActions">
              <Button onClick={() => refresh({ page: 1 })} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh feed"}
              </Button>
              <a className="blogListHeroLink" href="/blog/rss.xml" target="_blank" rel="noreferrer">
                Subscribe via RSS
              </a>
            </div>
          </div>
          <div className="blogListHeroImage" aria-hidden="true">
            <img
              src="https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&w=1200&q=80"
              alt=""
            />
          </div>
        </section>

        <div className="panelXL blogListPanel">
          <div className="panelTop">
            <div>
              <div className="panelTitle">Latest posts</div>
              <div className="panelSub">
                Showing <span className="pill">{rangeLabel}</span>
              </div>
            </div>

            <div className="panelActions">
              <input
                className="search"
                placeholder="Search posts…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <input
                className="search"
                placeholder="Tag (optional)"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                style={{ maxWidth: 180 }}
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
        </div>
        {allTags.length ? (
          <div className="tagRow">
            <div className="muted">Quick tags:</div>
            {allTags.map((t) => (
              <Link
                key={t}
                className={`tag ${tag === t ? "tagOn" : ""}`}
                to={`/blog/tag/${encodeURIComponent(t)}`}
              >
                #{t}
              </Link>
            ))}
          </div>
        ) : null}

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
      </div>

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
