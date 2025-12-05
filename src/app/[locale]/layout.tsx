import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { LanguageInitializer } from "@/components/language-initializer";
import "../globals.css";

const locales = ["en", "ur", "ru"] as const;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    title: messages.common?.appName || "DukaanKhata",
    description: messages.common?.appDescription || "Point of Sale & Business Management System",
  };
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocalizedRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  if (!locales.includes(locale as any)) {
    notFound();
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} dir={locale === "ur" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body>
        <LanguageInitializer />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
