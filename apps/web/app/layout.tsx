import type { Metadata, Viewport } from "next";
import {
  Exo_2,
  Geist,
  Geist_Mono,
} from "next/font/google";
import "./globals.css";
import InstallMixParty from "../components/InstallMixParty";
import ProfileOnboarding from "../components/ProfileOnboarding";

export const viewport: Viewport = {
  themeColor: "#090711",
};
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const exo2 = Exo_2({
  variable: "--font-exo-2",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "MixParty",
    template: "%s | MixParty",
  },
  description: "La musique appartient à tout le monde.",
  applicationName: "MixParty",

  icons: {
    icon: [
      { url: "/branding/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/branding/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/branding/icon.png",
    shortcut: "/branding/icon.png",
  },

  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
  lang="fr"
  suppressHydrationWarning
  data-scroll-behavior="smooth"
  className={`${geistSans.variable} ${geistMono.variable} ${exo2.variable} h-full antialiased`}
>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <ProfileOnboarding />
        {children}
        <InstallMixParty />
      </body>
    </html>
  );
}