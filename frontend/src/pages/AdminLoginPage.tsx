import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Toast, { type ToastState } from "../components/Toast";
import { adminLogin } from "../api";
import { resolveErrorMessage } from "../utils/errors";

export default function AdminLoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin12345");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast({ kind: "idle" });
    setLoading(true);

    try {
      await adminLogin({ username, password });

      setToast({ kind: "ok", msg: "Signed in!" });

      // ✅ redirect to an EXISTING admin route
      window.setTimeout(() => {
        nav("/admin/users");
      }, 300);
    } catch (err) {
      setToast({
        kind: "err",
        msg: resolveErrorMessage(err, "Login failed"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title="Admin access"
      subtitle="Login to approve or reject new signups."
      leftBadge="Admin • Protected • JWT Session"
    >
      <div className="cardXL">
        <div className="cardHead">
          <div>
            <div className="cardTitle">Admin Sign In</div>
            <div className="cardSub">
              Use the admin credentials from <span className="mono">.env</span>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="formGrid">
          <TextField
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />

          <TextField
            label="Password"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            right={
              <button
                className="miniBtn"
                type="button"
                onClick={() => setShowPass((s) => !s)}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            }
          />

          <div className="actionsRow">
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

            <div className="hint">
              Back to{" "}
              <a className="link" href="/">
                Sign Up
              </a>
            </div>
          </div>
        </form>
      </div>

      <Toast toast={toast} onClear={() => setToast({ kind: "idle" })} />
    </Shell>
  );
}
