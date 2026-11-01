import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { DashboardShell } from "@/components/dashboard-shell";
import { getWorkspaceStatus } from "@/server/workspace";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Overview · DukaanPilot", template: "%s · DukaanPilot" },
  description: "Your business, a little more organised. Pakistan-first orders, udhaar and follow-ups.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const status = await getWorkspaceStatus();
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <DashboardShell status={status}>{children}</DashboardShell>
      </body>
    </html>
  );
}
