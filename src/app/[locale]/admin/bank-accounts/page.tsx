import React from "react";
import { BankAccountsClient } from "./bank-accounts-client";
import { requireServerPermission } from "@/lib/auth/rbac";

export default async function BankAccountsPage({ params }: { params: { locale: string } }) {
  await requireServerPermission("payment_methods.view", params.locale, "/admin");

  return (
      <BankAccountsClient locale={params.locale} />
  );
}
