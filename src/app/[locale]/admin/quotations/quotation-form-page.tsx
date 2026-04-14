// // Quotation Create/Edit Form UI - Professional Form with Party & Item Management
// "use client";

// export const dynamic = "force-dynamic";

// import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
// import { useLocale, useTranslations } from "next-intl";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
// import { ArrowLeft, Plus, Edit2, Trash2, Loader2, Calculator } from "lucide-react";
// import { PartyDropdown } from "@/components/dropdown/party-dropdown";
// import { ErrorDialog } from "@/components/dialogs/error-dialog";
// import { formatCurrencyString } from "@/lib/utils";
// import { Separator } from "@/components/ui/separator";

// interface QuotationItem {
//   id: string;
//   product_id: string;
//   product_name: string;
//   product_description?: string;
//   quantity: number;
//   unit_price: number; // Changed from sell_price to unit_price to match your DB
//   amount: number;
// }

// function QuotationFormPageInner({ mode = "create", quotationId }: { mode?: "create" | "edit"; quotationId?: string }) {
//   const t = useTranslations("invoice");
//   const tCommon = useTranslations("common");
//   const locale = useLocale();
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const quotationIdFromUrl = searchParams.get("id") || quotationId;

//   const [products, setProducts] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
//   const [selectedPartyId, setSelectedPartyId] = useState<string>("");
//   const [selectedPartyName, setSelectedPartyName] = useState<string>("");
//   const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
//   const [discount, setDiscount] = useState<string>("0");
//   const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed");
//   const [tax, setTax] = useState<string>("0");
//   const [taxType, setTaxType] = useState<"percentage" | "fixed">("fixed");
//   const [validityDate, setValidityDate] = useState<string>("");
//   const [notes, setNotes] = useState<string>("");
//   const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
//   const [editingItemId, setEditingItemId] = useState<string | null>(null);
//   const [selectedProduct, setSelectedProduct] = useState<string>("");
//   const [itemQuantity, setItemQuantity] = useState<string>("1");
//   const [isSaving, setIsSaving] = useState(false);
//   const [errorDialog, setErrorDialog] = useState({ open: false, title: "", message: "", isSuccess: false });

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const productsRes = await fetch(`/${locale}/api/products`);
//         if (productsRes.ok) {
//           const data = await productsRes.json();
//           setProducts(Array.isArray(data) ? data : []);
//         }

//         if (quotationIdFromUrl) {
//           const quotRes = await fetch(`/${locale}/api/quotations/${quotationIdFromUrl}`);
//           if (quotRes.ok) {
//             const data = await quotRes.json();
//             const quot = data.quotation || data;
//             if (quot) {
//               setEditingQuotationId(quot._id || quot.id);
//               setSelectedPartyId(quot.party_id);
//               setSelectedPartyName(quot.party_name);
//               // Handle items mapping unit_price properly
//               const mappedItems = (quot.items || []).map((item: any) => ({
//                 ...item,
//                 id: item.id || `item-${Math.random()}`,
//                 unit_price: item.unit_price || item.sell_price || 0
//               }));
//               setQuotationItems(mappedItems);
//               setDiscount(quot.discount?.toString() || "0");
//               setDiscountType(quot.discount_type || "fixed");
//               setTax(quot.tax?.toString() || "0");
//               setTaxType(quot.tax_type || "fixed");
//               setValidityDate(quot.validity_date ? quot.validity_date.split('T')[0] : "");
//               setNotes(quot.notes || "");
//             }
//           }
//         }
//       } catch (error) {
//         console.error("Error:", error);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, [locale, quotationIdFromUrl]);

//   const calculations = useMemo(() => {
//     const subtotal = quotationItems.reduce((sum, item) => sum + item.amount, 0);
//     const dVal = discountType === "percentage" ? (subtotal * Number(discount || 0)) / 100 : Number(discount || 0);
//     const afterDiscount = subtotal - dVal;
//     const tVal = taxType === "percentage" ? (afterDiscount * Number(tax || 0)) / 100 : Number(tax || 0);
//     return { subtotal, discountValue: dVal, taxValue: tVal, totalAmount: afterDiscount + tVal };
//   }, [quotationItems, discount, discountType, tax, taxType]);

//   const handleAddItem = useCallback(() => {
//     const product = products.find((p) => p.id === selectedProduct || p._id === selectedProduct);
//     if (!product) return;

//     const qty = Number(itemQuantity) || 1;
//     const price = product.unit_price || product.sell_price || 0;
//     const newItem = {
//       id: editingItemId || `item-${Date.now()}`,
//       product_id: product._id || product.id,
//       product_name: product.name,
//       product_description: product.description,
//       quantity: qty,
//       unit_price: price,
//       amount: qty * price,
//     };

//     if (editingItemId) {
//       setQuotationItems(quotationItems.map((it) => (it.id === editingItemId ? newItem : it)));
//     } else {
//       setQuotationItems([...quotationItems, newItem]);
//     }
//     setIsItemDialogOpen(false);
//     setEditingItemId(null);
//     setSelectedProduct("");
//     setItemQuantity("1");
//   }, [selectedProduct, itemQuantity, editingItemId, quotationItems, products]);

//   const handleSaveQuotation = async () => {
//     if (!selectedPartyId || quotationItems.length === 0 || !validityDate) {
//       setErrorDialog({ open: true, title: tCommon("error"), message: "Fill all required fields", isSuccess: false });
//       return;
//     }

//     setIsSaving(true);
//     try {
//       const payload = {
//         party_id: selectedPartyId,
//         party_name: selectedPartyName,
//         items: quotationItems,
//         discount: Number(discount),
//         discount_type: discountType,
//         tax: Number(tax),
//         tax_type: taxType,
//         total_amount: calculations.totalAmount,
//         validity_date: validityDate,
//         status: "pending",
//         notes,
//       };

//       const res = await fetch(`/${locale}/api/quotations${editingQuotationId ? `/${editingQuotationId}` : ""}`, {
//         method: editingQuotationId ? "PUT" : "POST",
//         body: JSON.stringify(editingQuotationId ? { ...payload, id: editingQuotationId } : payload),
//         headers: { "Content-Type": "application/json" }
//       });

//       if (!res.ok) throw new Error();
//       setErrorDialog({ open: true, title: tCommon("success"), message: t("saved_successfully"), isSuccess: true });
//       setTimeout(() => router.push(`/${locale}/admin/quotations`), 1500);
//     } catch (e) {
//       setErrorDialog({ open: true, title: tCommon("error"), message: "Failed to save", isSuccess: false });
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

//   return (
//     <div className="max-w-7xl mx-auto space-y-6 pb-10">
//       {/* Simple Header */}
//       <div className="flex items-center justify-between border-b pb-4 mt-4">
//         <div className="flex items-center gap-3">
//           <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
//           <h1 className="text-2xl font-bold">{editingQuotationId ? t("edit_quotation") : t("create_quotation")}</h1>
//         </div>
//         <div className="flex gap-2">
//           <Button variant="outline" onClick={() => router.back()}>{tCommon("cancel")}</Button>
//           <Button onClick={handleSaveQuotation} disabled={isSaving}>
//             {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//             {tCommon("save")}
//           </Button>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
//         <div className="lg:col-span-8 space-y-6">
//           {/* Party Selection */}
//           <Card>
//             <CardHeader><CardTitle className="text-base">{t("party_details")}</CardTitle></CardHeader>
//             <CardContent>
//               <PartyDropdown
//                 value={selectedPartyId}
//                 onValueChange={(val, p) => { setSelectedPartyId(val); setSelectedPartyName(p?.name || ""); }}
//                 placeholder={t("select_party")}
//                 className="w-full"
//               />
//             </CardContent>
//           </Card>

//           {/* Items Table */}
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between">
//               <CardTitle className="text-base">{t("items")}</CardTitle>
//               <Button size="sm" onClick={() => setIsItemDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> {t("add_item")}</Button>
//             </CardHeader>
//             <CardContent className="p-0">
//               <div className="border-t">
//                 <table className="w-full text-sm">
//                   <thead className="bg-muted/50 text-muted-foreground">
//                     <tr className="text-left">
//                       <th className="p-4 font-medium">{t("item_name")}</th>
//                       <th className="p-4 font-medium text-center">{t("qty")}</th>
//                       <th className="p-4 font-medium text-right">{t("price")}</th>
//                       <th className="p-4 font-medium text-right">{t("total")}</th>
//                       <th className="p-4 text-center"></th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y">
//                     {quotationItems.length === 0 ? (
//                       <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">{t("no_items")}</td></tr>
//                     ) : (
//                       quotationItems.map((item) => (
//                         <tr key={item.id} className="hover:bg-muted/30">
//                           <td className="p-4">
//                             <div className="font-medium">{item.product_name}</div>
//                             <div className="text-xs text-muted-foreground">{item.product_description}</div>
//                           </td>
//                           <td className="p-4 text-center">{item.quantity}</td>
//                           <td className="p-4 text-right">{formatCurrencyString(item.unit_price)}</td>
//                           <td className="p-4 text-right font-semibold">{formatCurrencyString(item.amount)}</td>
//                           <td className="p-4 text-center">
//                             <div className="flex gap-1 justify-center">
//                               <Button variant="ghost" size="icon" onClick={() => {
//                                 setEditingItemId(item.id);
//                                 setSelectedProduct(item.product_id);
//                                 setItemQuantity(item.quantity.toString());
//                                 setIsItemDialogOpen(true);
//                               }}><Edit2 className="h-4 w-4" /></Button>
//                               <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setQuotationItems(quotationItems.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4" /></Button>
//                             </div>
//                           </td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardContent className="pt-6">
//               <Label>{t("notes")}</Label>
//               <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("add_notes")} className="mt-2" />
//             </CardContent>
//           </Card>
//         </div>

//         {/* Right Sidebar Summary */}
//         <div className="lg:col-span-4">
//           <Card className="sticky top-6">
//             <CardHeader className="border-b bg-muted/20">
//               <CardTitle className="text-base flex items-center gap-2">{t("summary")}</CardTitle>
//             </CardHeader>
//             <CardContent className="pt-6 space-y-4">
//               <div className="space-y-2">
//                 <Label>{t("validity_date")}</Label>
//                 <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
//               </div>
//               <Separator />
//               <div className="space-y-3">
//                 <div className="flex justify-between text-sm">
//                   <span className="text-muted-foreground">{t("subtotal")}</span>
//                   <span>{formatCurrencyString(calculations.subtotal)}</span>
//                 </div>
//                 <div className="space-y-2">
//                   <div className="flex justify-between text-sm">
//                     <span className="text-muted-foreground">{t("discount")}</span>
//                     <span className="text-destructive">-{formatCurrencyString(calculations.discountValue)}</span>
//                   </div>
//                   <div className="flex gap-2">
//                     <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8" />
//                     <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
//                       <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
//                       <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
//                     </Select>
//                   </div>
//                 </div>
//                 <div className="space-y-2">
//                   <div className="flex justify-between text-sm">
//                     <span className="text-muted-foreground">{t("tax")}</span>
//                     <span>{formatCurrencyString(calculations.taxValue)}</span>
//                   </div>
//                   <div className="flex gap-2">
//                     <Input type="number" value={tax} onChange={(e) => setTax(e.target.value)} className="h-8" />
//                     <Select value={taxType} onValueChange={(v: any) => setTaxType(v)}>
//                       <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
//                       <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
//                     </Select>
//                   </div>
//                 </div>
//               </div>
//               <Separator />
//               <div className="flex justify-between items-center py-2">
//                 <span className="font-bold">{t("total")}</span>
//                 <span className="text-xl font-bold text-primary">{formatCurrencyString(calculations.totalAmount)}</span>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>

//       {/* Product Modal */}
//       <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
//         <DialogContent>
//           <DialogHeader><DialogTitle>{editingItemId ? t("edit_item") : t("add_item")}</DialogTitle></DialogHeader>
//           <div className="space-y-4 py-4">
//             <div className="space-y-2">
//               <Label>{t("select_product")}</Label>
//               <Select value={selectedProduct} onValueChange={setSelectedProduct}>
//                 <SelectTrigger><SelectValue placeholder={t("select_product")} /></SelectTrigger>
//                 <SelectContent>
//                   {products.map(p => (
//                     <SelectItem key={p.id || p._id} value={p.id || p._id}>{p.name} - {formatCurrencyString(p.unit_price || p.sell_price || 0)}</SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div className="space-y-2">
//               <Label>{t("qty")}</Label>
//               <Input type="number" value={itemQuantity} onChange={(e) => setItemQuantity(e.target.value)} min="1" />
//             </div>
//           </div>
//           <div className="flex justify-end gap-2">
//             <Button variant="ghost" onClick={() => setIsItemDialogOpen(false)}>{tCommon("cancel")}</Button>
//             <Button onClick={handleAddItem}>{tCommon("confirm")}</Button>
//           </div>
//         </DialogContent>
//       </Dialog>

//       <ErrorDialog
//         open={errorDialog.open}
//         onOpenChange={(v) => setErrorDialog(p => ({ ...p, open: v }))}
//         title={errorDialog.title}
//         message={errorDialog.message}
//         isSuccess={errorDialog.isSuccess}
//       />
//     </div>
//   );
// }

// export default function QuotationFormPage({ mode = "create", quotationId }: { mode?: "create" | "edit"; quotationId?: string }) {
//   return (
//     <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
//       <QuotationFormPageInner mode={mode} quotationId={quotationId} />
//     </Suspense>
//   );
// }



// app/[locale]/admin/quotations/form/page.tsx (or your route)
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { formatCurrencyString } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface QuotationItem {
    id: string;
    product_id: string;
    product_name: string;
    product_description?: string;
    quantity: number;
    unit_price: number;
    amount: number;
}

function QuotationFormPageInner({
    mode = "create",
    quotationId,
}: {
    mode?: "create" | "edit";
    quotationId?: string;
}) {
    const t = useTranslations("invoice");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const quotationIdFromUrl = searchParams.get("id") || quotationId;

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingQuotationId, setEditingQuotationId] = useState<string | null>(
        null
    );
    const [selectedPartyId, setSelectedPartyId] = useState<string>("");
    const [selectedPartyName, setSelectedPartyName] = useState<string>("");
    const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
    const [discount, setDiscount] = useState<string>("0");
    const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
        "fixed"
    );
    const [tax, setTax] = useState<string>("0");
    const [taxType, setTaxType] = useState<"percentage" | "fixed">("fixed");
    const [validityDate, setValidityDate] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [selectedProductObj, setSelectedProductObj] = useState<any>(null);
    const [itemQuantity, setItemQuantity] = useState<string>("1");
    const [isSaving, setIsSaving] = useState(false);
    const [errorDialog, setErrorDialog] = useState({
        open: false,
        title: "",
        message: "",
        isSuccess: false,
    });

    // Fetch products and existing quotation data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const productsRes = await fetch(`/${locale}/api/products`);
                if (productsRes.ok) {
                    const data = await productsRes.json();
                    setProducts(Array.isArray(data) ? data : []);
                }

                if (quotationIdFromUrl) {
                    const quotRes = await fetch(
                        `/${locale}/api/quotations/${quotationIdFromUrl}`
                    );
                    if (quotRes.ok) {
                        const data = await quotRes.json();
                        const quot = data.quotation || data;
                        if (quot) {
                            setEditingQuotationId(quot._id || quot.id);
                            setSelectedPartyId(quot.party_id);
                            setSelectedPartyName(quot.party_name);
                            const mappedItems = (quot.items || []).map((item: any) => ({
                                ...item,
                                id: item.id || `item-${Math.random()}`,
                                unit_price: item.unit_price || item.sell_price || 0,
                            }));
                            setQuotationItems(mappedItems);
                            setDiscount(quot.discount?.toString() || "0");
                            setDiscountType(quot.discount_type || "fixed");
                            setTax(quot.tax?.toString() || "0");
                            setTaxType(quot.tax_type || "fixed");
                            setValidityDate(
                                quot.validity_date ? quot.validity_date.split("T")[0] : ""
                            );
                            setNotes(quot.notes || "");
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [locale, quotationIdFromUrl]);

    // Calculations
    const calculations = useMemo(() => {
        const subtotal = quotationItems.reduce((sum, item) => sum + item.amount, 0);
        const discountVal =
            discountType === "percentage"
                ? (subtotal * Number(discount || 0)) / 100
                : Number(discount || 0);
        const afterDiscount = subtotal - discountVal;
        const taxVal =
            taxType === "percentage"
                ? (afterDiscount * Number(tax || 0)) / 100
                : Number(tax || 0);
        return {
            subtotal,
            discountValue: discountVal,
            taxValue: taxVal,
            totalAmount: afterDiscount + taxVal,
        };
    }, [quotationItems, discount, discountType, tax, taxType]);

    // Add / Edit item
    const handleAddItem = useCallback(() => {
        if (!selectedProductObj) {
            setErrorDialog({
                open: true,
                title: tCommon("error"),
                message: "Please select a product",
                isSuccess: false,
            });
            return;
        }

        const qty = Number(itemQuantity) || 1;
        const price =
            selectedProductObj.unit_price ||
            selectedProductObj.sell_price ||
            selectedProductObj.price ||
            0;
        const newItem: QuotationItem = {
            id: editingItemId || `item-${Date.now()}`,
            product_id: selectedProductObj.id || selectedProductObj._id,
            product_name: selectedProductObj.name,
            product_description: selectedProductObj.description,
            quantity: qty,
            unit_price: price,
            amount: qty * price,
        };

        if (editingItemId) {
            setQuotationItems(
                quotationItems.map((it) => (it.id === editingItemId ? newItem : it))
            );
        } else {
            setQuotationItems([...quotationItems, newItem]);
        }
        setIsItemDialogOpen(false);
        setEditingItemId(null);
        setSelectedProductId("");
        setSelectedProductObj(null);
        setItemQuantity("1");
    }, [selectedProductObj, itemQuantity, editingItemId, quotationItems, tCommon]);

    // Save quotation
    const handleSaveQuotation = async () => {
        if (!selectedPartyId || quotationItems.length === 0 || !validityDate) {
            setErrorDialog({
                open: true,
                title: tCommon("error"),
                message: "Fill all required fields",
                isSuccess: false,
            });
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                party_id: selectedPartyId,
                party_name: selectedPartyName,
                items: quotationItems,
                discount: Number(discount),
                discount_type: discountType,
                tax: Number(tax),
                tax_type: taxType,
                total_amount: calculations.totalAmount,
                validity_date: validityDate,
                status: "pending",
                notes,
            };

            const url = editingQuotationId
                ? `/${locale}/api/quotations/${editingQuotationId}`
                : `/${locale}/api/quotations`;
            const method = editingQuotationId ? "PUT" : "POST";
            const body = editingQuotationId
                ? JSON.stringify({ ...payload, id: editingQuotationId })
                : JSON.stringify(payload);

            const res = await fetch(url, {
                method,
                body,
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) throw new Error();
            setErrorDialog({
                open: true,
                title: tCommon("success"),
                message: t("saved_successfully"),
                isSuccess: true,
            });
            setTimeout(() => router.push(`/${locale}/admin/quotations`), 1500);
        } catch (e) {
            setErrorDialog({
                open: true,
                title: tCommon("error"),
                message: "Failed to save quotation",
                isSuccess: false,
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mt-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">
                        {editingQuotationId ? t("edit_quotation") : t("create_quotation")}
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.back()}>
                        {tCommon("cancel")}
                    </Button>
                    <Button onClick={handleSaveQuotation} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {tCommon("save")}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Party Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t("party_details")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PartyDropdown
                                value={selectedPartyId}
                                onValueChange={(val, p) => {
                                    setSelectedPartyId(val);
                                    setSelectedPartyName(p?.name || "");
                                }}
                                placeholder={t("select_party")}
                                className="w-full"
                            />
                        </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">{t("items")}</CardTitle>
                            <Button size="sm" onClick={() => setIsItemDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-1" /> {t("add_item")}
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="border-t">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr className="text-left">
                                            <th className="p-4 font-medium">{t("item_name")}</th>
                                            <th className="p-4 font-medium text-center">
                                                {t("qty")}
                                            </th>
                                            <th className="p-4 font-medium text-right">
                                                {t("price")}
                                            </th>
                                            <th className="p-4 font-medium text-right">
                                                {t("total")}
                                            </th>
                                            <th className="p-4 text-center"></th>
                                        </tr>
                                    </thead>
                                    {/* <tbody className="divide-y">
                                        {quotationItems.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="p-10 text-center text-muted-foreground"
                                                >
                                                    {t("no_items")}
                                                </td>
                                            </tr>
                                        ) : (
                                            quotationItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-muted/30">
                                                    <td className="p-4">
                                                        <div className="font-medium">
                                                            {item.product_name}
                                                        </div>
                                                        {item.product_description && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {item.product_description.length > 60
                                                                    ? item.product_description.substring(0, 57) +
                                                                    "..."
                                                                    : item.product_description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">{item.quantity}</td>
                                                    <td className="p-4 text-right">
                                                        {formatCurrencyString(item.unit_price)}
                                                    </td>
                                                    <td className="p-4 text-right font-semibold">
                                                        {formatCurrencyString(item.amount)}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex gap-1 justify-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setEditingItemId(item.id);
                                                                    setSelectedProductId(item.product_id);
                                                                    // Find product object from list
                                                                    const prod = products.find(
                                                                        (p) =>
                                                                            (p.id || p._id) === item.product_id
                                                                    );
                                                                    setSelectedProductObj(prod || null);
                                                                    setItemQuantity(item.quantity.toString());
                                                                    setIsItemDialogOpen(true);
                                                                }}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive"
                                                                onClick={() =>
                                                                    setQuotationItems(
                                                                        quotationItems.filter(
                                                                            (i) => i.id !== item.id
                                                                        )
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody> */}
                                    <tbody className="divide-y">
  {quotationItems.length === 0 ? (
    <tr>
      <td colSpan={5} className="p-10 text-center text-muted-foreground">
        {t("no_items")}
      </td>
    </tr>
  ) : (
    quotationItems.map((item) => (
      <tr key={item.id} className="hover:bg-muted/30">
        {/* Product Name + Description */}
        <td className="p-4">
          <div className="font-medium">{item.product_name}</div>
          {item.product_description && (
            <div className="text-xs text-muted-foreground">
              {item.product_description.length > 60
                ? item.product_description.substring(0, 57) + "..."
                : item.product_description}
            </div>
          )}
        </td>

        {/* Quantity - Input Field */}
        <td className="p-4 text-center">
          <input
            type="number"
            min="0"
            step="1"
            value={item.quantity}
            onChange={(e) => {
              const newQuantity = parseFloat(e.target.value) || 0;
              const updatedItems = quotationItems.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      quantity: newQuantity,
                      amount: newQuantity * i.unit_price,
                    }
                  : i
              );
              setQuotationItems(updatedItems);
            }}
            className="w-24 px-2 py-1 border rounded text-center"
          />
        </td>

        {/* Unit Price - Input Field */}
        <td className="p-4 text-right">
          <input
            type="number"
            min="0"
            step="any"
            value={item.unit_price}
            onChange={(e) => {
              const newPrice = parseFloat(e.target.value) || 0;
              const updatedItems = quotationItems.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      unit_price: newPrice,
                      amount: i.quantity * newPrice,
                    }
                  : i
              );
              setQuotationItems(updatedItems);
            }}
            className="w-28 px-2 py-1 border rounded text-right"
          />
        </td>

        {/* Total Amount (Dynamic) */}
        <td className="p-4 text-right font-semibold">
          {formatCurrencyString(item.amount)}
        </td>

        {/* Action Buttons */}
        <td className="p-4 text-center">
          <div className="flex gap-1 justify-center">
            {/* <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingItemId(item.id);
                setSelectedProductId(item.product_id);
                const prod = products.find(
                  (p) => (p.id || p._id) === item.product_id
                );
                setSelectedProductObj(prod || null);
                setItemQuantity(item.quantity.toString());
                setIsItemDialogOpen(true);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button> */}
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() =>
                setQuotationItems(quotationItems.filter((i) => i.id !== item.id))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    ))
  )}
</tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card>
                        <CardContent className="pt-6">
                            <Label>{t("notes")}</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={t("add_notes")}
                                className="mt-2"
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Sidebar Summary */}
                <div className="lg:col-span-4">
                    <Card className="sticky top-6">
                        <CardHeader className="border-b bg-muted/20">
                            <CardTitle className="text-base flex items-center gap-2">
                                {t("summary")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label>{t("validity_date")}</Label>
                                <Input
                                    type="date"
                                    value={validityDate}
                                    onChange={(e) => setValidityDate(e.target.value)}
                                />
                            </div>
                            <Separator />
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{t("subtotal")}</span>
                                    <span>{formatCurrencyString(calculations.subtotal)}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            {t("discount")}
                                        </span>
                                        <span className="text-destructive">
                                            -{formatCurrencyString(calculations.discountValue)}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            value={discount}
                                            onChange={(e) => setDiscount(e.target.value)}
                                            className="h-8"
                                        />
                                        <Select
                                            value={discountType}
                                            onValueChange={(v: any) => setDiscountType(v)}
                                        >
                                            <SelectTrigger className="h-8 w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fixed">Fixed</SelectItem>
                                                <SelectItem value="percentage">%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{t("tax")}</span>
                                        <span>{formatCurrencyString(calculations.taxValue)}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            value={tax}
                                            onChange={(e) => setTax(e.target.value)}
                                            className="h-8"
                                        />
                                        <Select
                                            value={taxType}
                                            onValueChange={(v: any) => setTaxType(v)}
                                        >
                                            <SelectTrigger className="h-8 w-24">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fixed">Fixed</SelectItem>
                                                <SelectItem value="percentage">%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center py-2">
                                <span className="font-bold">{t("total")}</span>
                                <span className="text-xl font-bold text-primary">
                                    {formatCurrencyString(calculations.totalAmount)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add/Edit Item Modal with ProductDropdown */}
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItemId ? t("edit_quotation_item") : t("add_item")}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t("select_product")}</Label>
                            <ProductDropdown
                                value={selectedProductId}
                                onValueChange={(productId, product) => {
                                    setSelectedProductId(productId);
                                    setSelectedProductObj(product || null);
                                }}
                                addButtonPosition="top"
                                placeholder={t("select_product")}
                                enableSearch={true}
                                searchPlaceholder={tCommon('searchProduct')}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("qty")}</Label>
                            <Input
                                type="number"
                                value={itemQuantity}
                                onChange={(e) => setItemQuantity(e.target.value)}
                                min="1"
                                step="1"
                            />
                        </div>
                        {selectedProductObj && (
                            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Price:</span>
                                    <span className="font-medium">
                                        {formatCurrencyString(
                                            selectedProductObj.unit_price ||
                                            selectedProductObj.sell_price ||
                                            0
                                        )}
                                    </span>
                                </div>
                                {selectedProductObj.description && (
                                    <div>
                                        <span className="text-muted-foreground">Description:</span>
                                        <p className="text-xs mt-0.5">
                                            {selectedProductObj.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsItemDialogOpen(false)}>
                            {tCommon("cancel")}
                        </Button>
                        <Button onClick={handleAddItem}>{tCommon("confirm")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ErrorDialog
                open={errorDialog.open}
                onOpenChange={(v) => setErrorDialog((p) => ({ ...p, open: v }))}
                title={errorDialog.title}
                message={errorDialog.message}
                isSuccess={errorDialog.isSuccess}
            />
        </div>
    );
}

export default function QuotationFormPage({
    mode = "create",
    quotationId,
}: {
    mode?: "create" | "edit";
    quotationId?: string;
}) {
    return (
        <Suspense
            fallback={
                <div className="h-screen flex items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8" />
                </div>
            }
        >
            <QuotationFormPageInner mode={mode} quotationId={quotationId} />
        </Suspense>
    );
}