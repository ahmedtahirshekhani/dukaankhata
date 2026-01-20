import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import "./globals.css";

const locales = ["en", "ur", "ru"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: "en", namespace: "common" });

  return {
    title: t("appName"),
    description: t("appDescription"),
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        {
          url: "/icons/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("appName"),
    },
    formatDetection: {
      telephone: false,
    },
    openGraph: {
      type: "website",
      siteName: t("appName"),
      title: t("appName"),
      description: t("appDescription"),
    },
    twitter: {
      card: "summary",
      title: t("appName"),
      description: t("appDescription"),
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <meta name="application-name" content="DukaanKhata" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DukaanKhata" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
