// Quotation List Page
import { Metadata } from "next";
import QuotationListPage from "./quotation-list-page";

export const metadata: Metadata = {
  title: "Quotations",
};

export default function Page() {
  return <QuotationListPage />;
}
