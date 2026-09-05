"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";

export function QuickActions() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const { can, hasModuleAccess } = usePermissions();

  const canCreateSale = can("sales", "create_invoice");
  const canCreatePurchase = can("purchase", "create_purchase_bill");
  
  // Additional quick actions
  const canCreateCustomer = can("customers", "create");
  const canCreatePaymentIn = can("sales", "create_payment_in");

  return (
    <div className="flex items-center gap-2 lg:flex">
      {canCreateSale && (
        <Link href={`/${locale}/admin/sales/invoice/new`}>
          <Button size="sm" className="bg-primary hover:bg-secondary/80 text-white hover:text-secondary-foreground border border-primary rounded-full px-4 h-8 text-xs font-semibold shadow-sm">
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            {tNav("addInvoice") || "Add Invoice"}
          </Button>
        </Link>
      )}
      
      {canCreatePurchase && (
        <Link href={`/${locale}/admin/purchase/purchase-bill/new`}>
          <Button size="sm" className="bg-primary hover:bg-secondary/80 text-white hover:text-secondary-foreground border border-primary rounded-full px-4 h-8 text-xs font-semibold shadow-sm">
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            {tNav("addPurchase") || "Add Purchase"}
          </Button>
        </Link>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" className="w-8 h-8 rounded-full bg-background border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm">
            <PlusCircle className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canCreateCustomer && (
             <DropdownMenuItem asChild>
               <Link href={`/${locale}/admin/customers`}>
                 <PlusCircle className="w-4 h-4 mr-2" />
                 {tNav("addCustomer") || "Add Party"}
               </Link>
             </DropdownMenuItem>
          )}
          {canCreatePaymentIn && (
             <DropdownMenuItem asChild>
               <Link href={`/${locale}/admin/sales/payment-in`}>
                 <PlusCircle className="w-4 h-4 mr-2" />
                 {tNav("addPaymentIn") || "Payment In"}
               </Link>
             </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
