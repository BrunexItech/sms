import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import { ScrollToTop } from "@/components/ScrollToTop";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "National Sports Registration Platform | Ministry of Sports, Kenya",
  description:
    "Register your club, team or sports organisation under the Sports Act 2013, and trace every sports facility across Kenya's 47 counties.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body>
        <LangProvider>
          <StoreProvider>
            {children}
            <ScrollToTop />
          </StoreProvider>
        </LangProvider>
      </body>
    </html>
  );
}
