import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GTM agents, ready to work · OpenComputer",
  description:
    "Turn an email into context. Build GTM engineering workflows with a serverless enrichment agent, then deploy your own template.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
