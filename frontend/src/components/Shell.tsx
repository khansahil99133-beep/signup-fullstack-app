import React from "react";
import { BRAND_NAME } from "../env";

export type ShellMode = "default" | "center";

/**
 * Shell provides the shared background + top brand bar.
 * - default: left hero + right content (admin/dashboard style)
 * - center: centered single column (auth/signup style)
 */
export default function Shell(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightTop?: React.ReactNode;
  leftBadge?: string;
  mode?: ShellMode;
  noHero?: boolean;
  contentClassName?: string;
}) {
  const mode: ShellMode = props.mode ?? "default";

  return (
    <div className="bg">
      <header className="topbar">
        <div className="brandWrap">
          <div className="brandMark" aria-hidden="true" />
          <div>
            <div className="brand">{BRAND_NAME}</div>
            <div className="brandSub">{props.leftBadge ?? "Secure • Fast • Verified"}</div>
          </div>
        </div>
        <div className="topActions">{props.rightTop}</div>
      </header>

      {mode === "center" ? (
        <main className="layoutCenter">
          <section className={["contentCenter", props.contentClassName].filter(Boolean).join(" ")}>
            {props.children}
          </section>
        </main>
      ) : (
        <main className="layout">
          {props.noHero ? (
            <section className="content layoutNoHero">{props.children}</section>
          ) : (
            <>
              <section className="hero">
                <div className="heroGlow" aria-hidden="true" />
                <div className="heroCard">
                  <div className="heroKicker">Welcome</div>
                  <div className="heroTitle">{props.title}</div>
                  {props.subtitle ? <div className="heroSub">{props.subtitle}</div> : null}

                  <div className="heroList">
                    <div className="heroItem">
                      <div className="heroDot" />
                      <div>Admin approval workflow for new sign ups.</div>
                    </div>
                    <div className="heroItem">
                      <div className="heroDot" />
                      <div>Audit trail for approvals/rejections and exports.</div>
                    </div>
                    <div className="heroItem">
                      <div className="heroDot" />
                      <div>Blog powered by backend APIs (RSS + sitemap).</div>
                    </div>
                  </div>

                  <div className="heroFooter">
                    <a className="heroLink" href="/blog">
                      Blog
                    </a>
                  </div>
                </div>
              </section>

              <section className="content">{props.children}</section>
            </>
          )}
        </main>
      )}
    </div>
  );
}
