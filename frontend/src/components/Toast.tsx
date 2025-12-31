import React, { useEffect } from "react";

export type ToastState =
  | { kind: "idle" }
  | { kind: "ok"; msg: string }
  | { kind: "err"; msg: string };

export default function Toast(props: { toast: ToastState; onClear: () => void }) {
  const { toast, onClear } = props;

  useEffect(() => {
    if (toast.kind === "idle") return;
    const t = window.setTimeout(onClear, 2600);
    return () => window.clearTimeout(t);
  }, [toast, onClear]);

  if (toast.kind === "idle") return null;

  return (
    <div className={`toast ${toast.kind === "ok" ? "toastOk" : "toastErr"}`} role="status">
      <div className="toastDot" />
      <div className="toastMsg">{toast.msg}</div>
      <button className="toastX" onClick={onClear} aria-label="Close">
        ×
      </button>
    </div>
  );
}
