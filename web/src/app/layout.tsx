import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Is this person a fit? · OpenComputer",
  description:
    "Qualify a lead from one email. Get a sourced profile, ICP fit assessment, reasons, and a suggested next step. Try free, then deploy your own agent.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
