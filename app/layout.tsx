import type { Metadata } from "next";

import { BASE_TITLE } from "@/lib/feeds";

import "./globals.css";

export const metadata: Metadata = {
  title: BASE_TITLE,
  description: "Het laatste nieuws over Ajax uit vier bronnen.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
