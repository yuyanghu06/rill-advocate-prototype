import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rill Advocate",
  description: "Build your profile. Get discovered.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
