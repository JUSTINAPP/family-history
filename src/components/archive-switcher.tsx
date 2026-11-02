"use client";
import Link from "next/link";
import { useRef } from "react";
import { Check, ChevronDown, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
export function ArchiveSwitcher() {
  const { archive, archives, selectArchive, role, mode } = useWorkspace();
  const panel = useRef<HTMLDetailsElement>(null);
  if (mode === "live") return (
    <Link href="/" className="archive-switcher" aria-label="Allen & Cork archive home">
      <span className="archive-identity"><span className="archive-current-name">{archive.name === "The Allen & Cork Archive" ? "Allen & Cork" : archive.name}</span><span className="archive-identity-label">Archive</span></span>
    </Link>
  );
  return (
    <details
      ref={panel}
      className="archive-switcher"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          panel.current?.removeAttribute("open");
          panel.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={`Current archive: ${archive.name}`}>
        <span className="archive-identity"><span className="archive-current-name">{archive.name === "The Allen & Cork Archive" ? "Allen & Cork" : archive.name}</span><span className="archive-identity-label">Archive</span></span>
        <ChevronDown size={13} aria-hidden="true" />
      </summary>
      <div className="archive-switcher-panel">
        <p className="eyebrow">YOUR ARCHIVES</p>
        <ul>
          {archives.map((a) => (
            <li key={a.id}>
              <button
                aria-current={a.id === archive.id ? "true" : undefined}
                onClick={async () => {
                  if (await selectArchive(a.id))
                    panel.current?.removeAttribute("open");
                }}
              >
                <span>
                  {a.name}
                  <small>
                    {a.id === archive.id
                      ? `${role[0].toUpperCase() + role.slice(1)} · current archive`
                      : "Open archive"}
                  </small>
                </span>
                {a.id === archive.id ? (
                  <Check size={16} />
                ) : (
                  <ArrowUpRight size={16} />
                )}
              </button>
            </li>
          ))}
        </ul>
        {archives.length === 1 && (
          <p className="help-line">
            {mode === "demo"
              ? "This account has one archive in the demo."
              : "Your access is specific to this archive."}
          </p>
        )}
        <Link href="/" onClick={() => panel.current?.removeAttribute("open")}>
          Archive home
          <ArrowUpRight size={14} />
        </Link>
        <Link
          href="/admin/settings"
          onClick={() => panel.current?.removeAttribute("open")}
        >
          Archive settings
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </details>
  );
}
