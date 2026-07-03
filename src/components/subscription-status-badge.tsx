"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useUserProfile } from "@/hooks/use-user-profile";
import { signOut } from "next-auth/react";
import { clearUserDatabase } from "@/lib/db/offline-db";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { proAccessPaymentInfo } from "@/lib/contact-info";

interface SubscriptionStatus {
  isActive: boolean;
  isPending: boolean;
  isExpired: boolean;
  plan: string;
  daysRemaining: number;
  expiryDate: Date | null;
  startDate: Date | null;
  status: string;
  isRenewal: boolean;
}

export function SubscriptionStatusBadge() {
  const locale = useLocale();
  const t = useTranslations("landing.pricing");
  const pathname = usePathname();
  const { user } = useUserProfile();
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [proDialogOpen, setProDialogOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch(`/${locale}/api/subscriptions/status`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data);
          
          if (data.status === "login_blocked") {
            clearUserDatabase().then(() =>
              signOut({ callbackUrl: `/${locale}/login?error=login_blocked` })
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch subscription status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [user?.id, locale, pathname]);

  if (loading || !subscriptionStatus) {
    return null;
  }

  const getStatusColor = () => {
    if (subscriptionStatus.isPending) {
      return subscriptionStatus.isRenewal 
        ? "bg-orange-100 text-orange-800 border-orange-300"
        : "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
    if (subscriptionStatus.isActive) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (subscriptionStatus.isExpired) {
      if (
        subscriptionStatus.status === "payment_expire" ||
        (subscriptionStatus.status === "expired" && subscriptionStatus.isRenewal)
      ) {
        return "bg-orange-100 text-orange-800 border-orange-300";
      }
      return "bg-red-100 text-red-800 border-red-300";
    }
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getStatusIcon = () => {
    if (subscriptionStatus.isPending) {
      return <Clock className="h-3.5 w-3.5" />;
    }
    if (subscriptionStatus.isActive) {
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    }
    if (subscriptionStatus.isExpired) {
      return <AlertCircle className="h-3.5 w-3.5" />;
    }
    return null;
  };

  const getStatusLabel = () => {
    if (subscriptionStatus.isPending) {
      return subscriptionStatus.isRenewal ? "Grace Period (Renew Pro)" : "Pending";
    }
    if (subscriptionStatus.isActive) {
      return `${["trial", "in_trial"].includes(subscriptionStatus.status) ? "Trial" : "Active"}`;
    }
    if (subscriptionStatus.isExpired) {
      if (
        subscriptionStatus.status === "payment_expire" ||
        subscriptionStatus.status === "expired"
      ) {
        return subscriptionStatus.isRenewal ? "Grace Period (Renew Pro)" : "Trial Expired (Buy Pro)";
      }
      if (subscriptionStatus.status === "login_blocked") return "Blocked";
      return "Expired";
    }
    return "No Subscription";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const tooltipText = `Expires: ${formatDate(subscriptionStatus.expiryDate)}`;
  const whatsappLink = `${proAccessPaymentInfo.proofWhatsappHref}?text=${encodeURIComponent(
    t("dialogWhatsappMessage"),
  )}`;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={() => setProDialogOpen(true)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer hover:opacity-80 ${getStatusColor()}`}
            >
              {getStatusIcon()}
              <span className="hidden sm:inline">{getStatusLabel()}</span>
              {subscriptionStatus.daysRemaining > 0 && (
                <span className="hidden sm:inline border-l pl-1.5 border-current/30">
                  {subscriptionStatus.daysRemaining} days left
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{tooltipText} (Click for details)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={proDialogOpen} onOpenChange={setProDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {subscriptionStatus.isActive ? t("dialogActiveTitle") : t("dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {subscriptionStatus.isActive ? t("dialogActiveDescription") : t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <p className="font-semibold text-foreground border-b border-border/50 pb-2">
                {t("subscriptionDetailsTitle")}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">{t("planLabel")}</span>
                <span className="font-medium capitalize">{subscriptionStatus.plan || 'N/A'}</span>
                
                <span className="text-muted-foreground">{t("statusLabel")}</span>
                <span className="font-medium capitalize">{subscriptionStatus.status?.replace('_', ' ') || 'N/A'}</span>
                
                {subscriptionStatus.startDate && (
                  <>
                    <span className="text-muted-foreground">{t("startDateLabel")}</span>
                    <span className="font-medium">{formatDate(subscriptionStatus.startDate)}</span>
                  </>
                )}
                
                {subscriptionStatus.expiryDate && (
                  <>
                    <span className="text-muted-foreground">{t("expiryDateLabel")}</span>
                    <span className="font-medium">{formatDate(subscriptionStatus.expiryDate)}</span>
                  </>
                )}
                
                {subscriptionStatus.isExpired && subscriptionStatus.status !== "login_blocked" && (
                  <>
                    <span className="text-muted-foreground">{t("gracePeriodLabel")}</span>
                    <span className="font-medium text-orange-600">{t("gracePeriodActive")}</span>
                  </>
                )}
              </div>
            </div>
            {!subscriptionStatus.isActive && (
              <>
                <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                  <p className="font-semibold text-foreground border-b border-border/50 pb-2">
                    {t("dialogAccountTitle", {
                      provider: proAccessPaymentInfo.provider,
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {proAccessPaymentInfo.provider}
                  </p>
                  <p className="font-medium text-foreground">
                    {proAccessPaymentInfo.accountNumber}
                  </p>
                  <p className="text-muted-foreground">
                    {proAccessPaymentInfo.accountHolder}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                  <p className="font-semibold text-foreground">
                    {t("dialogWhatsappTitle")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("dialogWhatsappDescription", {
                      whatsapp: proAccessPaymentInfo.proofWhatsappDisplay,
                    })}
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setProDialogOpen(false)}>
              {t("dialogClose")}
            </Button>
            {!subscriptionStatus.isActive && (
              <Button asChild>
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  {t("dialogOpenWhatsapp")}
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
