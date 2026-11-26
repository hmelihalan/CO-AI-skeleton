import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CO-AI SRS Workspace",
  description: "SENG 491 running skeleton for database-backed SRS drafting",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
