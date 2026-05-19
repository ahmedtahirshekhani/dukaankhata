// Quotation View/Print Page
import { Metadata } from "next";
import QuotationViewPage from "../../quotation-view-page";

export const metadata: Metadata = {
  title: "Quotation Details",
};

export default function Page({ params }: { params: { id: string } }) {
  return <QuotationViewPage id={params.id} />;
}
