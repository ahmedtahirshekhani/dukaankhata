// Quotation Edit Page
import { Metadata } from "next";
import QuotationFormPage from "../quotation-form-page";

export const metadata: Metadata = {
  title: "Edit Quotation",
};

export default function Page({ params }: { params: { id: string } }) {
  return <QuotationFormPage mode="edit" quotationId={params.id} />;
}
