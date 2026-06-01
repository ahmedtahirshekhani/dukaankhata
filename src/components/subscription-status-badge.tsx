"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface SubscriptionStatus {
  isActive: boolean;
  isPending: boolean;
  isExpired: boolean;
  plan: string;
  daysRemaining: number;
  expiryDate: Date | null;
  status: string;
}

export function SubscriptionStatusBadge() {
  const locale = useLocale();
  const { user } = useUserProfile();
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
        }
      } catch (error) {
        console.error("Failed to fetch subscription status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [user?.id, locale]);

  if (loading || !subscriptionStatus) {
    return null;
  }

  const getStatusColor = () => {
    if (subscriptionStatus.isPending) {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
    if (subscriptionStatus.isActive) {
      return "bg-green-100 text-green-800 border-green-300";
    }
    if (subscriptionStatus.isExpired) {
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
      return "Pending";
    }
    if (subscriptionStatus.isActive) {
      return `${subscriptionStatus.plan === "trial" ? "Trial" : "Active"}`;
    }
    if (subscriptionStatus.isExpired) {
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

  const tooltipText = `${getStatusLabel()} • Expires: ${formatDate(subscriptionStatus.expiryDate)} • ${subscriptionStatus.daysRemaining} days left`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-help ${getStatusColor()}`}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusLabel()}</span>
            <span className="sm:hidden">
              {subscriptionStatus.daysRemaining}d
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
