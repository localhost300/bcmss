import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bishop Crowther Memorial School",
  description: "Examination and Result Portl",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your environment before running the app."
    );
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders publishableKey={publishableKey}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
