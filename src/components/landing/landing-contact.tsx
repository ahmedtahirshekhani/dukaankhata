"use client";

import { Phone, MessageSquare, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supportContacts } from "@/lib/contact-info";

export function LandingContact() {
  const t = useTranslations("landing.contact");

  return (
    <section
      id="contact"
      className="w-full py-16 md:py-24 bg-gradient-to-b from-muted/50 to-muted/20 border-t border-border"
    >
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            {t("sectionTitle")}
          </h2>
          <p className="text-muted-foreground md:text-lg max-w-2xl mx-auto">
            {t("sectionDescription")}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 items-stretch">
          {/* Support Highlight Card */}
          <Card className="flex flex-col justify-between border-primary/20 bg-primary/[0.02] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl transform translate-x-8 -translate-y-8 pointer-events-none" />
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">24/7 WhatsApp Support</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Get instant help from our support team on WhatsApp. We are here to answer your questions and help you set up your account.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-8">
              <a
                href="https://wa.me/923212575665"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full"
              >
                <Button className="w-full gap-2" size="lg">
                  Chat on WhatsApp
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Contact Numbers List Card */}
          <Card className="shadow-sm flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Support Directory</CardTitle>
              <CardDescription>
                Reach out to our representatives directly via WhatsApp or call.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              {supportContacts.map((c) => (
                <a
                  key={c.name}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {c.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">Support Agent</p>
                    </div>
                  </div>
                  <div className="text-primary group-hover:underline text-sm font-semibold flex items-center gap-1">
                    {c.display}
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
