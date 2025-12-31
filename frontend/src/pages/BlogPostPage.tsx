import { SITE_NAME } from "../env";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import Shell from "../components/Shell";
import Toast, { type ToastState } from "../components/Toast";
import { getBlog, type BlogPost } from "../api";
import {
  clearJsonLd,
  setArticleTimes,
  setCanonical,
  setDocumentTitle,
  setJsonLd,
  setMetaDescription,
  setOgTags,
  setTwitterTags,
} from "../utils/meta";
import { resolveErrorMessage } from "../utils/errors";

function toLocal(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const resp = await getBlog(slug);
        if (!alive) return;
        setPost(resp.post);
        setRelated(Array.isArray(resp.related) ? resp.related : []);

        const title = resp.post?.title ? `${resp.post.title} · Blog` : "Blog post";
        const desc = (resp.post?.excerpt || "").slice(0, 180) || "Read the latest post.";
        const url = `${window.location.origin}/blog/${resp.post?.slug || ""}`;

        setDocumentTitle(title);
        setMetaDescription(desc);
        setCanonical(url);
        setOgTags({ title, description: desc, url, image: resp.post?.coverImageUrl || null });
        setTwitterTags({ title, description: desc, image: resp.post?.coverImageUrl || null });
        setArticleTimes({
          publishedTime: resp.post?.publishedAt || resp.post?.createdAt || null,
          modifiedTime: resp.post?.updatedAt || null,
        });

        const jsonLd = {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: resp.post?.title || "",
          description: desc,
          image: resp.post?.coverImageUrl ? [resp.post.coverImageUrl] : undefined,
          datePublished: resp.post?.publishedAt || resp.post?.createdAt || undefined,
          dateModified:
            resp.post?.updatedAt || resp.post?.publishedAt || resp.post?.createdAt || undefined,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          url,
          author: { "@type": "Organization", name: SITE_NAME },
          publisher: { "@type": "Organization", name: SITE_NAME },
        };

        setJsonLd("jsonld-blog-post", jsonLd);
      } catch (err) {
        if (!alive) return;
        setToast({ kind: "err", msg: resolveErrorMessage(err, "Not found") });
        setPost(null);
        setRelated([]);
        setDocumentTitle("Blog · Not found");
        setMetaDescription("Blog post not found.");
        clearJsonLd("jsonld-blog-post");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [slug]);

  const meta = useMemo(() => {
    if (!post) return "";
    const dt = post.publishedAt || post.createdAt;
    const tags = post.tags?.length ? ` · ${post.tags.map((t) => `#${t}`).join(" ")}` : "";
    return `${toLocal(dt)}${tags}`;
  }, [post]);

  async function onShare() {
    if (!post) return;
    const url = `${window.location.origin}/blog/${post.slug}`;
    const text = `${post.title}\n${url}`;
    try {
      const shareNavigator = navigator as Navigator & {
        share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
      };
      if (shareNavigator.share) {
        await shareNavigator.share({ title: post.title, text: post.excerpt || post.title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setToast({ kind: "ok", msg: "Link copied" });
      } else {
        window.prompt("Copy this link:", url);
      }
    } catch (err) {
      setToast({ kind: "err", msg: resolveErrorMessage(err, "Share failed") });
    }
  }

  return (
    <Shell
      title={post?.title || "Blog post"}
      subtitle={post ? meta : "Loading…"}
      leftBadge="Public · Blog"
      noHero
    >
      <div className="blogContainer">
        <div className="blogTopNav">
          <Link className="link" to="/blog">
            ← Back
          </Link>
          <button className="chip" type="button" onClick={onShare} disabled={!post || loading}>
            Share
          </button>
        </div>

        {loading ? (
          <div className="mutedCell">Loading…</div>
        ) : post ? (
          <>
            <section className="blogHeroSection">
              <div className="blogHeroCopy">
                <div className="blogHeroKicker">Welcome</div>
                <h1 className="blogHeroTitle">{post.title}</h1>
                <div className="blogHeroMeta">
                  <span>{toLocal(post.publishedAt || post.createdAt)}</span>
                  {post.tags && post.tags.length ? (
                    <span>
                      {post.tags
                        .slice(0, 3)
                        .map((t) => `#${t}`)
                        .join(" ")}
                    </span>
                  ) : null}
                </div>
                <ul className="blogHeroList">
                  <li>Admin approval workflow for new sign ups.</li>
                  <li>Audit trail for approvals, rejections, and exports.</li>
                  <li>Blog powered by backend APIs (RSS + sitemap).</li>
                </ul>
              </div>
              {post.coverImageUrl ? (
                <div className="blogHeroImage">
                  <img src={post.coverImageUrl} alt="" />
                </div>
              ) : null}
            </section>

            <article className="blogArticle">
              <ReactMarkdown className="md">{post.contentMarkdown || ""}</ReactMarkdown>
            </article>

            {related.length ? (
              <div className="relatedBox">
                <div className="relatedTitle">Related posts</div>
                <div className="relatedGrid">
                  {related.map((r) => (
                    <Link key={r.id} to={`/blog/${r.slug}`} className="relatedCard">
                      <div className="relatedCardTitle">{r.title}</div>
                      <div className="relatedCardMeta">
                        {(r.tags || [])
                          .slice(0, 3)
                          .map((t) => `#${t}`)
                          .join(" ")}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mutedCell">Not found.</div>
        )}
      </div>

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
