import type { Metadata } from "next";
import "./globals.css";
import { LogoutButton } from "./LogoutButton";
export const metadata: Metadata = {
  title: "Aegis RAG",
  description: "Multi-tenant retrieval intelligence",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <LogoutButton />
      </body>
    </html>
  );
}
