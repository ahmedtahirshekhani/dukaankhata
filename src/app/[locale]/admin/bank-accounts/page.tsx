import React from "react";
import { BankAccountsClient } from "./bank-accounts-client";
import { requireServerPermission } from "@/lib/auth/rbac";

export default async function BankAccountsPage({ params }: { params: { locale: string } }) {
  await requireServerPermission("payment_methods.view", params.locale, "/admin");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <BankAccountsClient locale={params.locale} />
      </div>
    </div>
  );
}
