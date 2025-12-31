import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Toast, { type ToastState } from "../components/Toast";
import { signup, listBlog, type ApiValidationError, type BlogPost } from "../api";
import { BRAND_NAME } from "../env";
import { resolveErrorMessage } from "../utils/errors";

function validateEmail(v: string): boolean {
  if (!v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function validateE164(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v.trim());
}

function validateUsername(v: string): boolean {
  if (!v.trim()) return false;
  if (v.trim().length < 3 || v.trim().length > 24) return false;
  return /^[A-Za-z0-9_]+$/.test(v.trim());
}

function validateTelegram(v: string): boolean {
  if (!v.trim()) return true;
  const core = v.trim().startsWith("@") ? v.trim().slice(1) : v.trim();
  if (core.length < 5 || core.length > 32) return false;
  if (!/^[A-Za-z0-9_]+$/.test(core)) return false;
  if (core.startsWith("_") || core.endsWith("_")) return false;
  if (core.includes("__")) return false;
  return true;
}

function validatePassword(v: string): boolean {
  if (v.trim().length < 8) return false;
  return /[A-Za-z]/.test(v) && /\d/.test(v);
}

function formatSidebarDate(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? ts
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function SidebarPostCard({ post }: { post: BlogPost }) {
  const dateLabel = formatSidebarDate(post.publishedAt ?? post.createdAt);
  return (
    <Link className="signupSidebarPost" to={`/blog/${post.slug}`}>
      {post.coverImageUrl ? (
        <div
          className="signupSidebarPostImage"
          style={{ backgroundImage: `url(${post.coverImageUrl})` }}
          role="img"
          aria-label={post.title}
        />
      ) : (
        <div className="signupSidebarPostImage signupSidebarPostImageEmpty" aria-hidden="true" />
      )}
      <div>
        <div className="signupSidebarPostDate">{dateLabel}</div>
        <div className="signupSidebarPostTitle">{post.title}</div>
        <div className="signupSidebarPostExcerpt">{post.excerpt}</div>
      </div>
    </Link>
  );
}

export default function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  const [toast, setToast] = useState<ToastState>({ kind: "idle" });
  const [loading, setLoading] = useState(false);
  const [serverFieldErr, setServerFieldErr] = useState<Record<string, string>>({});
  const [leftSidebarPosts, setLeftSidebarPosts] = useState<BlogPost[]>([]);
  const [rightSidebarPosts, setRightSidebarPosts] = useState<BlogPost[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    listBlog({ pageSize: 10, sort: "newest" })
      .then((resp) => {
        if (!alive) return;
        const posts = resp.items.slice(0, 4);
        const leftCount = 2;
        const rightCount = 2;
        setLeftSidebarPosts(posts.slice(0, leftCount));
        setRightSidebarPosts(posts.slice(leftCount, leftCount + rightCount));
      })
      .catch((err) => {
        console.error("Failed to load blog sidebar posts", err);
      });
    return () => {
      alive = false;
    };
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    if (!validateUsername(username)) e.username = "3-24 chars: letters, numbers, underscore only";
    if (!mobileNumber.trim()) e.mobileNumber = "Required";
    if (mobileNumber.trim() && !validateE164(mobileNumber))
      e.mobileNumber = "Use E.164 like +919876543210";
    if (whatsappNumber.trim() && !validateE164(whatsappNumber))
      e.whatsappNumber = "Use E.164 like +919876543210";
    if (!validateEmail(email)) e.email = "Invalid email";
    if (!validateTelegram(telegramUsername))
      e.telegramUsername = "Telegram: 5-32 chars, letters/numbers/underscore";
    if (!validatePassword(password)) e.password = "Min 8 chars, include 1 letter and 1 number";
    if (password2 !== password) e.password2 = "Passwords do not match";
    return e;
  }, [username, mobileNumber, whatsappNumber, email, telegramUsername, password, password2]);

  const canSubmit = useMemo(() => Object.values(errors).every((v) => !v), [errors]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast({ kind: "idle" });
    setServerFieldErr({});
    setLoading(true);
    try {
      await signup({
        username,
        email: email.trim() ? email : null,
        mobileNumber,
        whatsappNumber: whatsappNumber.trim() ? whatsappNumber : null,
        telegramUsername: telegramUsername.trim() ? telegramUsername : null,
        password,
      });

      navigate(`/success?username=${encodeURIComponent(username)}`, { replace: true });
      setUsername("");
      setEmail("");
      setMobileNumber("");
      setWhatsappNumber("");
      setTelegramUsername("");
      setPassword("");
      setPassword2("");
    } catch (err) {
      const data = (err as { data?: unknown }).data as ApiValidationError | undefined;
      if (data?.error === "validation_error" && Array.isArray(data.details)) {
        const map: Record<string, string> = {};
        for (const d of data.details) {
          if (!map[d.field]) map[d.field] = d.message;
        }
        setServerFieldErr(map);
        setToast({ kind: "err", msg: "Please fix highlighted fields." });
      } else {
        setToast({ kind: "err", msg: resolveErrorMessage(err, "Failed") });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell mode="center" title="Sign Up" contentClassName="signupContent">
      <div className="signupSceneWrapper">
        <div className="signupBlogSidebar signupBlogSidebarLeft">
          <div className="signupBlogSidebarLabel">From the blog</div>
          {leftSidebarPosts.length ? (
            leftSidebarPosts.map((post) => <SidebarPostCard key={post.id} post={post} />)
          ) : (
            <div className="signupSidebarPlaceholder">
              Publish a blog post from the admin to highlight it here.
            </div>
          )}
        </div>

        <div className="signupScene">
          <div className="signupBackdrop" aria-hidden="true" />

          <div className="signupPanel">
            <div className="signupHeader">
              <div className="signupTitle">Sign Up</div>
              <div className="signupSubtitle">
                Phones must be <span className="mono">E.164</span> (example:{" "}
                <span className="mono">+919876543210</span>).
              </div>
            </div>

            <form onSubmit={onSubmit} className="signupForm">
              <TextField
                label="Username"
                placeholder="Your username"
                value={username}
                onChange={setUsername}
                autoComplete="username"
                error={serverFieldErr.username ?? errors.username ?? null}
              />

              <TextField
                label="Email (optional)"
                placeholder="your@email.com"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                error={serverFieldErr.email ?? errors.email ?? null}
              />

              <TextField
                label="Mobile number"
                placeholder="+91 555 555 5555"
                value={mobileNumber}
                onChange={setMobileNumber}
                autoComplete="tel"
                error={serverFieldErr.mobileNumber ?? errors.mobileNumber ?? null}
              />

              <TextField
                label="WhatsApp number (optional)"
                placeholder="+91 555 555 5555"
                value={whatsappNumber}
                onChange={setWhatsappNumber}
                autoComplete="tel"
                error={serverFieldErr.whatsappNumber ?? errors.whatsappNumber ?? null}
              />

              <TextField
                label="Telegram username (optional)"
                placeholder="@yourusername"
                value={telegramUsername}
                onChange={setTelegramUsername}
                error={serverFieldErr.telegramUsername ?? errors.telegramUsername ?? null}
              />

              <TextField
                label="Create password"
                placeholder="At least 8 characters"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                error={serverFieldErr.password ?? errors.password ?? null}
                right={
                  <button className="miniBtn" type="button" onClick={() => setShowPass((s) => !s)}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                }
              />

              <TextField
                label="Re-enter password"
                placeholder="Re-enter password"
                type={showPass2 ? "text" : "password"}
                value={password2}
                onChange={setPassword2}
                autoComplete="new-password"
                error={serverFieldErr.password2 ?? errors.password2 ?? null}
                right={
                  <button className="miniBtn" type="button" onClick={() => setShowPass2((s) => !s)}>
                    {showPass2 ? "Hide" : "Show"}
                  </button>
                }
              />

              <div className="actionsRow">
                <Button type="submit" disabled={!canSubmit || loading}>
                  {loading ? "Creating..." : "Create account"}
                </Button>

                <div className="signupHint">
                  Already on {BRAND_NAME}?{" "}
                  <a className="link" href="/admin/login">
                    Sign in
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="signupBlogSidebar signupBlogSidebarRight">
          <div className="signupBlogSidebarLabel">Latest update</div>
          {rightSidebarPosts.length ? (
            rightSidebarPosts.map((post) => <SidebarPostCard key={post.id} post={post} />)
          ) : (
            <div className="signupSidebarPlaceholder">
              Check the blog for the latest announcements.
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
