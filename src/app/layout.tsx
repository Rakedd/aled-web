import type { Metadata } from "next";
import { Figtree, Manrope } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-init-script";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Aled",
  description: "Trouver du travail sans traverser la rue.",
  robots: { index: false, follow: false },
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html
    lang="fr"
    className={`${manrope.variable} ${figtree.variable} h-full antialiased`}
    suppressHydrationWarning
  >
    <head>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
    </head>
    <body className="min-h-full flex flex-col">{children}</body>
  </html>
);

export default RootLayout;
