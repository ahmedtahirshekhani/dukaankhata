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
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
