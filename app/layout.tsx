import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipFlow — Your content, in motion",
  description: "Plan, organise and publish social content from one workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
