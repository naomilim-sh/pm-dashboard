import type { Metadata } from "next";
import "./globals.css";
import RecoveryLinkHandler from "@/components/RecoveryLinkHandler";

export const metadata: Metadata = {
  title: "PM Dashboard",
  description: "A dashboard for tracking projects, trackers, and email drafts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RecoveryLinkHandler />
        {children}
      </body>
    </html>
  );
}
