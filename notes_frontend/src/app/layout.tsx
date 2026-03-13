import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteMaster",
  description: "Modern notes app with tags, search, pin & favorites.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
