import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PM Dashboard",
  description: "A dashboard for tracking projects, trackers, and email drafts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
