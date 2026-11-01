"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { signOut } from "@/app/sign-in/actions";
import { ArchiveSwitcher } from "./archive-switcher";
import { useWorkspace } from "./workspace-provider";
import { Search, Plus, Menu, X, ArrowUpRight, LockKeyhole, House, Users } from "lucide-react";
import { can } from "@/lib/permissions";
const nav = [
  ["Home", "/"],
  ["Explore", "/explore"],
  ["People", "/people"],
  ["Places", "/places"],
  ["Stories", "/stories"],
];
export function Header() {
  const path = usePathname();
  const { role, mode, profileName, profileEmail } = useWorkspace();
  const menuButton=useRef<HTMLButtonElement>(null),profileButton=useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header" onKeyDown={e=>{if(e.key==="Escape"){if(open){setOpen(false);menuButton.current?.focus();}else if(profile){setProfile(false);profileButton.current?.focus();}}}}>
        <ArchiveSwitcher />
        <nav className="desktop-nav" aria-label="Main navigation">
          {nav.map(([name, href]) => (
            <Link
              key={href}
              className={
                path === href || (href !== "/" && path.startsWith(href))
                  ? "active"
                  : ""
              }
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            href="/explore?focus=search"
            aria-label="Search the archive"
            className="icon-button"
          >
            <Search size={19} />
          </Link>
          <Link href="/add" className="add-button" aria-label="Add to archive">
            <Plus size={17} />
            <span>Add to archive</span>
          </Link>
          <div className="profile-wrap">
            <button
              ref={profileButton}
              className="avatar"
              aria-label="Account"
              aria-expanded={profile}
              onClick={() => {setProfile(!profile);setOpen(false);}}
            >
              {profileName
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </button>
            {profile && (
              <div className="profile-panel">
                <strong>
                  {mode === "live" ? profileName : "Welcome to the demo"}
                </strong>
                <p>
                  {mode === "live"
                    ? `${profileEmail} · ${role} in this archive`
                    : `You are exploring as a demo ${role}. Sign-in is represented; this demo is not a private vault.`}
                </p>
                <Link href="/admin" onClick={() => setProfile(false)}>
                  Archive administration <ArrowUpRight size={15} />
                </Link>
                {mode === "live" && can(role, "editor") && <>
                  <Link href="/explore?state=archived" onClick={() => setProfile(false)}>Archived items <ArrowUpRight size={15} /></Link>
                  <Link href="/admin/deletions" onClick={() => setProfile(false)}>Deletion progress <ArrowUpRight size={15} /></Link>
                </>}
                <Link href="/tree" onClick={() => setProfile(false)}>
                  View the family tree <ArrowUpRight size={15} />
                </Link>
                <Link href="/add/bulk" onClick={() => setProfile(false)}>
                  Bulk upload <ArrowUpRight size={15} />
                </Link>
                {mode === "live" && (
                  <form action={signOut}>
                    <button className="subtle-button">Sign out</button>
                  </form>
                )}
              </div>
            )}
          </div>
          <button
            ref={menuButton}
            className="icon-button mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-controls="mobile-navigation"
            aria-expanded={open}
            onClick={() => {setOpen(!open);setProfile(false);}}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        <nav className="mobile-primary-nav" aria-label="Primary mobile navigation">
          {([["Home", "/", House], ["Explore", "/explore", Search], ["Add", "/add", Plus], ["People", "/people", Users]] as const).map(([label, href, Icon]) => (
            <Link prefetch={false} key={href} href={href} aria-current={path === href || (href !== "/" && path.startsWith(href)) ? "page" : undefined} onClick={() => {setOpen(false);setProfile(false);}}>
              <Icon size={21} aria-hidden="true" /><span>{label}</span>
            </Link>
          ))}
        </nav>
        {open && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
            {nav.map(([name, href]) => (
              <Link prefetch={false} key={href} href={href} onClick={() => setOpen(false)}>
                {name}
                <ArrowUpRight size={20} />
              </Link>
            ))}
            <Link prefetch={false} href="/quick-catalogue" onClick={() => setOpen(false)}>Quick catalogue <ArrowUpRight size={20} /></Link>
            <Link prefetch={false} href="/add/bulk" onClick={() => setOpen(false)}>Bulk upload <ArrowUpRight size={20} /></Link>
            <Link prefetch={false} href="/admin" onClick={() => setOpen(false)}>
              Admin
              <ArrowUpRight size={20} />
            </Link>
            <Link prefetch={false} href="/tree" onClick={() => setOpen(false)}>
              Family tree
              <ArrowUpRight size={20} />
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
export function Footer() {
  const { mode } = useWorkspace();
  return (
    <footer className="site-footer">
      <div>
        <Link href="/" className="footer-mark">
          Allen &amp; Cork / Archive
        </Link>
        <p>Photographs, letters, documents and objects.</p>
      </div>
      <div className="footer-links">
        <Link href="/explore">Explore the archive</Link>
        <Link href="/tree">Family connections</Link>
        <Link href="/add">Contribute something</Link>
      </div>
      <div className="footer-note">
        <span>
          <LockKeyhole size={13} /> Private archive
        </span>
        <p>
          {mode === "live"
            ? "Private archive · authenticated access."
            : "Illustrative demo · No files are uploaded."}
          <br />
          {mode === "demo"
            ? "Names and stories are fictional."
            : "Original files stay unchanged."}{" "}
          <Link href="/about">About the material ↗</Link>
        </p>
      </div>
    </footer>
  );
}
