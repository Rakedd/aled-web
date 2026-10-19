import type { Metadata } from "next";
import { Figtree, Manrope } from "next/font/google";
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
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html
    lang="fr"
    className={`${manrope.variable} ${figtree.variable} h-full antialiased`}
  >
    <body className="min-h-full flex flex-col">{children}</body>
  </html>
);

export default RootLayout;
