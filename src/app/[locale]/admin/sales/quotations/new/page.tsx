// Quotation Create/Edit Form Page
import { Metadata } from "next";
import QuotationFormPage from "../quotation-form-page";

export const metadata: Metadata = {
  title: "New Quotation",
};

export default function Page() {
  return <QuotationFormPage mode="create" />;
}
