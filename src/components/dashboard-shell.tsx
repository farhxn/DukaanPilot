"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DashboardIcon, ReaderIcon, PersonIcon, FileTextIcon, CheckCircledIcon,
  BarChartIcon, ChatBubbleIcon, ArrowTopRightIcon, GearIcon,
  HamburgerMenuIcon, Cross2Icon, BackpackIcon, InfoCircledIcon,
} from "@radix-ui/react-icons";

const navigation = [
  { href: "/", label: "Overview", icon: DashboardIcon },
  { href: "/orders", label: "Orders", icon: ReaderIcon },
  { href: "/customers", label: "Customers", icon: PersonIcon },
  { href: "/suppliers", label: "Suppliers", icon: BackpackIcon },
  { href: "/ledger", label: "Ledger & udhaar", icon: FileTextIcon },
  { href: "/approvals", label: "Approvals", icon: CheckCircledIcon },
  { href: "/assistant", label: "Assistant", icon: ChatBubbleIcon },
  { href: "/messages", label: "WhatsApp & messages", icon: ChatBubbleIcon },
  { href: "/usage", label: "Usage", icon: BarChartIcon },
];

type WorkspaceStatus = { dateLabel: string; authEnabled: boolean; signedIn: boolean; businessName: string | null; accountLabel: string | null; accessNotice: string | null; localTest: boolean; whatsappEnabled: boolean };
export function DashboardShell({ children, status }: { children: React.ReactNode; status: WorkspaceStatus }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find((item) => item.href === pathname)?.label ?? (pathname === "/setup" ? "Workspace setup" : "Workspace");

  function closeMenu() { setMenuOpen(false); }

  return (
    <div className="app-frame">
      <header className="mobile-bar">
        <Link href="/" className="brand" onClick={closeMenu}><span className="brand-mark"><BackpackIcon /></span>DukaanPilot<span className="brand-period">.</span></Link>
        <button className="icon-button" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <Cross2Icon /> : <HamburgerMenuIcon />}</button>
      </header>
      {menuOpen && <button type="button" className="menu-scrim" aria-label="Close navigation overlay" onClick={closeMenu} />}
      <aside id="sidebar" className={`sidebar ${menuOpen ? "sidebar-open" : ""}`} onKeyDown={(event) => { if (event.key === "Escape") closeMenu(); }}>
        <Link href="/" className="brand desktop-brand" onClick={closeMenu}><span className="brand-mark"><BackpackIcon /></span>DukaanPilot<span className="brand-period">.</span></Link>
        <div className="workspace-label"><span className="workspace-monogram">DP</span><div><strong>{status.businessName ?? "Your workspace"}</strong><span>{status.businessName ? "Owner workspace" : "Let’s make it yours"}</span></div></div>
        <div className="nav-caption">Workspace</div>
        <nav aria-label="Main navigation">
          {navigation.filter(item => item.href !== "/messages" || status.whatsappEnabled).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "nav-link-active" : ""}`} aria-current={pathname === href ? "page" : undefined} onClick={closeMenu}><Icon /><span>{label}</span>{pathname === href && <span className="active-marker" />}</Link>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-note"><span className="connection-symbol"><ChatBubbleIcon /></span><strong>Your AI business assistant</strong><p>Manage your business here, in your browser.</p><Link href="/assistant" onClick={closeMenu}>Open assistant <ArrowTopRightIcon /></Link></div>
          <Link href="/setup" className={`nav-link ${pathname === "/setup" ? "nav-link-active" : ""}`} aria-current={pathname === "/setup" ? "page" : undefined} onClick={closeMenu}><GearIcon />Workspace setup</Link>
          <Link href={status.signedIn ? "/setup" : "/login"} className="sidebar-footer"><span className="avatar">DP</span><div><strong>{status.signedIn ? "Signed in" : "Sign in"}</strong><span>{status.accountLabel ?? "Open your business workspace"}</span></div></Link>
        </div>
      </aside>
      <div className="main-frame">
        <header className="topbar"><div className="breadcrumb">Workspace<span>/</span><strong>{current}</strong></div><div className="topbar-right"><span className="preview-badge">{status.localTest ? "Local test" : status.signedIn ? "Owner workspace" : "Local preview"}</span><span className="topbar-avatar" aria-hidden="true">DP</span></div></header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-context"><span>{status.dateLabel}</span><details className="preview-help"><summary><InfoCircledIcon />About this preview</summary><div>Use manual entry for orders, sales and confirmed receipts. Every financial action needs your approval. Assistant availability depends on your workspace configuration.</div></details></div>
          {status.accessNotice && <p role="alert" className="form-error">{status.accessNotice}</p>}
          {children}
          <footer className="content-footer"><span>DukaanPilot <span aria-hidden="true">·</span> Apki dukaan, apka saathi.</span><span>PKR <span aria-hidden="true">/</span> Asia/Karachi</span></footer>
        </main>
      </div>
    </div>
  );
}
