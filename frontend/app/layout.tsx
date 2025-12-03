import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portalight - Internal Developer Portal",
  description: "Centralized platform for managing services, observability, and self-service provisioning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
