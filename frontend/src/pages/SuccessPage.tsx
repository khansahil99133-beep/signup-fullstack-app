import React from "react";
import { useLocation } from "react-router-dom";
import Shell from "../components/Shell";
import { BRAND_NAME } from "../env";

function useQueryParam(key: string) {
  const { search } = useLocation();
  return new URLSearchParams(search).get(key) ?? "";
}

export default function SuccessPage() {
  const username = useQueryParam("username");
  const welcomeName = username || "player";
  return (
    <Shell mode="center" title="SignUp Successful">
      <div className="successScene">
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, idx) => {
            const style = { "--i": idx } as React.CSSProperties & { "--i": number };
            return <span key={idx} style={style} />;
          })}
        </div>
        <div className="successCard">
          <div className="successBadge">Success</div>
          <div className="successTitle">SignUp Successful</div>

          <div className="successFields">
            <div className="successField">
              <div className="successFieldLabel">Username</div>
              <div>{welcomeName}</div>
            </div>
            <div className="successField">
              <div className="successFieldLabel">Password</div>
              <div>Saved with Sign UP Jeetwin</div>
            </div>
          </div>

          <div className="successMessage">
            Welcome to {BRAND_NAME}, {welcomeName}. Contact our customer support for further
            process.
          </div>
          <a className="successCTA" href="mailto:support@signupjeetwin.com">
            Contact {BRAND_NAME} Support
          </a>
        </div>
      </div>
    </Shell>
  );
}
