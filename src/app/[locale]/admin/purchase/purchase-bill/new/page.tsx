
"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Edit2, Trash2, Plus, Loader2, X, ArrowLeft, Edit } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { formatCurrencyString } from "@/lib/utils";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import { Product } from "@/types/product";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";

// Local interfaces for this page
interface Party {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    balance?: number;
}

interface PaymentMethod {
    _id: string;
    id?: string;
    bank_name: string;
    bankName?: string;
    bankDetails?: string;
    type?: string;
    user_id?: string;
}

interface PurchaseBillItem {
    id: string;
    product_id: string | number;
    product_name: string;
    product_description?: string;
    quantity: number;
    cost_price: number;
    amount: number;
}

interface PurchaseBill {
    id?: string;
    party_id: string;
    party_name: string;
    items: PurchaseBillItem[];
    discount: number;
    discount_type: "percentage" | "fixed";
    tax: number;
    tax_type: "percentage" | "fixed";
    total_amount: number;
    paid_amount: number;
    balance_due: number;
    is_paid: boolean;
    payment_method_id?: string;
    payment_method_name?: string;
    description?: string;
    created_at?: string;
}

function AddPurchaseBillPageInner() {
    const t = useTranslations("purchaseBill");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const router = useRouter();
    const searchParams = useSearchParams();
    const billIdFromUrl = searchParams.get("id");

    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBillId, setEditingBillId] = useState<string | null>(null);

    const [selectedPartyId, setSelectedPartyId] = useState<string>("");
    const [selectedPartyName, setSelectedPartyName] = useState<string>("");
    const [billItems, setBillItems] = useState<PurchaseBillItem[]>([]);

    const [discount, setDiscount] = useState<string>("0");
    const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
        "fixed"
    );
    const [tax, setTax] = useState<string>("0");
    const [taxType, setTaxType] = useState<"percentage" | "fixed">("fixed");
    const [isPaid, setIsPaid] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
    const [paidAmount, setPaidAmount] = useState<string>("0");
    const [description, setDescription] = useState<string>("");

    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<string | number>("");
    const [selectedProductObj, setSelectedProductObj] = useState<Product | null>(null);
    const [itemQuantity, setItemQuantity] = useState<string>("1");

    const [errorDialog, setErrorDialog] = useState<{
        open: boolean;
        title?: string;
        message: string;
        isSuccess?: boolean;
    }>({
        open: false,
        message: "",
    });

    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        const fetchData = async () => {
            try {
                // Load bill data if editing
                if (billIdFromUrl) {
                    const bill = await db.purchase_bills.get(billIdFromUrl);
                    if (bill) {
                        setEditingBillId(bill.id || bill._id);
                        setSelectedPartyId(bill.party_id || bill.partyId);
                        setSelectedPartyName(bill.party_name || bill.partyName);
                        const loadedItems = (bill.items || []).map((item: any, idx: number) => ({
                            ...item,
                            id: item.id || `item-${idx}-${Date.now()}`
                        }));
                        setBillItems(loadedItems);
                        setDiscount(bill.discount?.toString() || "0");
                        setDiscountType(bill.discount_type || bill.discountType || "fixed");
                        setTax(bill.tax?.toString() || "0");
                        setTaxType(bill.tax_type || bill.taxType || "fixed");
                        setIsPaid((bill.paid_amount && bill.paid_amount > 0) || bill.is_paid || bill.isPaid || false);
                        setPaidAmount(bill.paid_amount?.toString() || bill.paidAmount?.toString() || "0");
                        setSelectedPaymentMethod(bill.payment_method_id || bill.paymentMethodId || "");
                        setDescription(bill.description || "");
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                setErrorDialog({
                    open: true,
                    title: t("error"),
                    message: t("failedToLoadData"),
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [locale, t, billIdFromUrl]);

    const calculations = useMemo(() => {
        const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0);

        const discountNum = parseFloat(discount || "0") || 0;
        const taxNum = parseFloat(tax || "0") || 0;

        const discountValue =
            discountType === "percentage"
                ? (subtotal * discountNum) / 100
                : discountNum;

        const subtotalAfterDiscount = subtotal - discountValue;

        const taxValue =
            taxType === "percentage"
                ? (subtotalAfterDiscount * taxNum) / 100
                : taxNum;

        const totalAmount = subtotalAfterDiscount + taxValue;
        const balanceDue = totalAmount - (parseFloat(paidAmount || "0") || 0);

        return {
            subtotal,
            discountValue,
            subtotalAfterDiscount,
            taxValue,
            totalAmount,
            balanceDue,
        };
    }, [billItems, discount, discountType, tax, taxType, paidAmount]);

    useEffect(() => {
        const pAmount = parseFloat(paidAmount || "0");
        if (isPaid && (calculations.balanceDue < 0 || pAmount < 0)) {
            setErrorDialog({
                open: true,
                title: t("validationError"),
                message: pAmount < 0 
                    ? (t("negativeAmountError") || "Paid amount cannot be less than 0")
                    : (t("overpaymentError") || "Paid amount cannot exceed the total amount"),
            });
            if (pAmount < 0) {
                setPaidAmount("0");
            } else {
                setPaidAmount(calculations.totalAmount.toString());
            }
        }
    }, [calculations.balanceDue, calculations.totalAmount, isPaid, paidAmount, t]);

    const handleAddItem = useCallback(() => {
        if (!selectedProduct) {
            setErrorDialog({
                open: true,
                title: t("validationError"),
                message: t("selectProduct"),
            });
            return;
        }

        const product = selectedProductObj;
        if (!product) {
            setErrorDialog({
                open: true,
                title: t("error"),
                message: t("productNotFound") || "Product not found. Please try again.",
            });
            return;
        }

        const quantity = Number(itemQuantity) || 1;
        const costPrice = product.cost_price || 0;
        const amount = quantity * costPrice;

        if (editingItemId) {
            setBillItems(
                billItems.map((item) =>
                    item.id === editingItemId
                        ? {
                            ...item,
                            product_id: product.id,
                            product_name: product.name,
                            product_description: product.description,
                            quantity,
                            cost_price: costPrice,
                            amount,
                        }
                        : item
                )
            );
            setEditingItemId(null);
        } else {
            setBillItems([
                ...billItems,
                {
                    id: `item-${Date.now()}`,
                    product_id: product.id,
                    product_name: product.name,
                    product_description: product.description,
                    quantity,
                    cost_price: costPrice,
                    amount,
                },
            ]);
        }

        setSelectedProduct("");
        setSelectedProductObj(null);
        setItemQuantity("1");
        setIsItemDialogOpen(false);
    }, [selectedProduct, selectedProductObj, itemQuantity, editingItemId, billItems, t]);

    const handleUpdateItemInline = useCallback((id: string, field: "quantity" | "cost_price", value: string) => {
        const numericValue = value === "" ? 0 : parseFloat(value);
        if (isNaN(numericValue) || numericValue < 0) return;

        setBillItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: numericValue };
                updatedItem.amount = updatedItem.quantity * updatedItem.cost_price;
                return updatedItem;
            }
            return item;
        }));
    }, []);

    const handleEditItem = useCallback((item: PurchaseBillItem) => {
        setEditingItemId(item.id);
        setSelectedProduct(item.product_id);
        setSelectedProductObj({
            id: item.product_id,
            name: item.product_name,
            description: item.product_description,
            cost_price: item.cost_price,
        } as Product);
        setItemQuantity(item.quantity.toString());
        setIsItemDialogOpen(true);
    }, []);

    const handleDeleteItem = useCallback((itemId: string) => {
        setBillItems(billItems.filter((item) => item.id !== itemId));
    }, [billItems]);

    const handleSaveBill = useCallback(async () => {
        if (!selectedPartyId) {
            setErrorDialog({
                open: true,
                title: t("validationError"),
                message: t("selectParty"),
            });
            return;
        }

        if (billItems.length === 0) {
            setErrorDialog({
                open: true,
                title: t("validationError"),
                message: t("addItems"),
            });
            return;
        }

        const currentPaidAmount = isPaid ? Number(paidAmount || 0) : 0;
        const currentTotalAmount = calculations.totalAmount;

        if (isPaid && currentPaidAmount < 0) {
            setErrorDialog({
                open: true,
                title: t("validationError"),
                message: t("negativeAmountError") || "Paid amount cannot be less than 0",
            });
            return;
        }

        if (isPaid && currentPaidAmount > currentTotalAmount) {
            setErrorDialog({
                open: true,
                title: t("validationError"),
                message: t("overpaymentError") || "Paid amount cannot exceed the total amount",
            });
            return;
        }

        setIsSaving(true);
        try {
            const billData: PurchaseBill = {
                party_id: selectedPartyId,
                party_name: selectedPartyName,
                items: billItems,
                discount: Number(discount || 0),
                discount_type: discountType,
                tax: Number(tax || 0),
                tax_type: taxType,
                total_amount: calculations.totalAmount,
                paid_amount: isPaid ? Number(paidAmount || 0) : 0,
                balance_due: calculations.balanceDue,
                is_paid: isPaid && calculations.balanceDue === 0,
                payment_method_id: selectedPaymentMethod,
                description,
            };

            const method = editingBillId ? "PUT" : "POST";
            const billId = editingBillId || `local-${Date.now()}`;
            
            const finalBillData = {
                id: billId,
                ...billData,
                created_at: new Date().toISOString()
            };

            // Update local DB instantly
            const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');
            if (editingBillId) {
                const oldBill = await db.purchase_bills.get(editingBillId);
                if (oldBill && oldBill.balance_due !== undefined) {
                    await updateOfflinePartyBalance(oldBill.party_id, oldBill.balance_due);
                }
                // Revert old stock
                if (oldBill && oldBill.items) {
                    for (const item of oldBill.items) {
                        if (item.product_id) await adjustOfflineStock(item.product_id, -(Number(item.quantity) || 0));
                    }
                }
                await db.purchase_bills.update(editingBillId, finalBillData);
                await updateOfflinePartyBalance(selectedPartyId, -finalBillData.balance_due);
                // Apply new stock
                for (const item of billItems) {
                    if (item.product_id) await adjustOfflineStock(item.product_id, Number(item.quantity) || 0);
                }
            } else {
                await db.purchase_bills.add(finalBillData);
                await updateOfflinePartyBalance(selectedPartyId, -finalBillData.balance_due);
                // Apply new stock
                for (const item of billItems) {
                    if (item.product_id) await adjustOfflineStock(item.product_id, Number(item.quantity) || 0);
                }
            }

            // Queue for sync
            await SyncEngine.queueOperation(
                "purchase_bills",
                method,
                `/${locale}/api/purchase-bills`,
                finalBillData,
                !editingBillId ? billId : undefined
            );

            setErrorDialog({
                open: true,
                title: t("success"),
                message: editingBillId ? t("updateSuccess") : t("billSavedSuccess"),
                isSuccess: true,
            });

            // Reset form after success
            setTimeout(() => {
                // Navigate back to listing page
                router.push(`/${locale}/admin/purchase/purchase-bill`);
            }, 1500);
        } catch (error) {
            setErrorDialog({
                open: true,
                title: t("error"),
                message: error instanceof Error ? error.message : (editingBillId ? t("failedToUpdateBill") : t("failedToSaveBill")),
            });
        } finally {
            setIsSaving(false);
        }
    }, [
        selectedPartyId,
        selectedPartyName,
        billItems,
        discount,
        discountType,
        tax,
        taxType,
        isPaid,
        paidAmount,
        selectedPaymentMethod,
        description,
        calculations,
        editingBillId,
        locale,
        t,
        router,
    ]);

    if (loading) {
        return (
            <div className="h-[80vh] flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">
                        {editingBillId ? t("editBill") || "Edit Bill" : t("title") || "Purchase Bill"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {editingBillId
                            ? t("billsEdit") || "Update purchase bill details"
                            : t("purchaseBilldescription") || "Create and manage purchase bills"}
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("billDetails") || "Bill Details"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Party Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="party">{t("partyName") || "Party Name"} *</Label>
                        <PartyDropdown
                            value={selectedPartyId}
                            onValueChange={(val, party) => {
                                setSelectedPartyId(val);
                                setSelectedPartyName(party?.name || "");
                            }}
                            placeholder={t("selectParty") || "Select a party"}
                            className="w-full"
                            filterActiveOnly={true}
                            enableSearch={true}
                            searchPlaceholder={typeof t("searchParty") === "string" && t("searchParty") ? t("searchParty") : "Search party..."}
                        />
                    </div>

                    {/* Billed Items */}
                    <div className="space-y-3">
                        <Label>{t("billedItems") || "Billed Items"} *</Label>
                        
                        {/* Mobile View (Cards) */}
                        <div className="md:hidden space-y-3">
                            {billItems.length === 0 ? (
                                <div className="p-4 text-center border rounded-lg text-muted-foreground">
                                    {t("noItems") || "No items added"}
                                </div>
                            ) : (
                                billItems.map((item, idx) => {
                                    const descriptionPreview = item.product_description
                                        ? item.product_description.length > 50
                                            ? item.product_description.substring(0, 50) + "..."
                                            : item.product_description
                                        : "";
                                    return (
                                        <div key={item.id} className="border rounded-lg p-3 space-y-3 bg-card">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-semibold text-sm">#{idx + 1} - {item.product_name}</div>
                                                    {descriptionPreview && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {descriptionPreview}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditItem(item)}>
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="icon" variant="danger" className="h-7 w-7" onClick={() => handleDeleteItem(item.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-end justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <div className="text-[10px] text-muted-foreground uppercase mb-1">{t("quantity") || "Qty"}</div>
                                                        <NumericInput
                                                            value={item.quantity === 0 ? "" : item.quantity}
                                                            onChange={(e) => handleUpdateItemInline(item.id, "quantity", e.target.value)}
                                                            className="h-8 w-16 text-xs px-2"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <span className="text-muted-foreground self-end mb-2">×</span>
                                                    <div>
                                                        <div className="text-[10px] text-muted-foreground uppercase mb-1">{t("rate") || "Rate"}</div>
                                                        <NumericInput
                                                            value={item.cost_price === 0 ? "" : item.cost_price}
                                                            onChange={(e) => handleUpdateItemInline(item.id, "cost_price", e.target.value)}
                                                            className="h-8 w-20 text-xs px-2"
                                                            min="0"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-muted-foreground uppercase mb-1">{t("total") || "Total"}</div>
                                                    <div className="font-medium text-sm">
                                                        {formatCurrencyString(item.amount)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop View (Table) */}
                        <div className="hidden md:block border rounded-lg overflow-x-auto">
                            <Table className="min-w-[600px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>{t("product") || "Product"}</TableHead>
                                        <TableHead className="w-[120px]">{t("quantity") || "Qty"}</TableHead>
                                        <TableHead className="w-[140px]">{t("rate") || "Rate"}</TableHead>
                                        <TableHead className="w-[120px] text-right">{t("amount") || "Amount"}</TableHead>
                                        <TableHead className="w-[100px] text-right">{t("actions") || "Actions"}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {billItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                {t("noItems") || "No items added"}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        billItems.map((item, idx) => {
                                            const descriptionPreview = item.product_description
                                                ? item.product_description.length > 30
                                                    ? item.product_description.substring(0, 30) + "..."
                                                    : item.product_description
                                                : "";
                                            return (
                                                <TableRow key={item.id} className="hover:bg-muted/50">
                                                    <TableCell className="font-medium">{idx + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium text-sm whitespace-nowrap">
                                                            {item.product_name}
                                                        </div>
                                                        {descriptionPreview && (
                                                            <div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
                                                                {descriptionPreview}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <NumericInput
                                                            value={item.quantity === 0 ? "" : item.quantity}
                                                            onChange={(e) => handleUpdateItemInline(item.id, "quantity", e.target.value)}
                                                            className="h-8 w-20 text-xs px-2"
                                                            min="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <NumericInput
                                                            value={item.cost_price === 0 ? "" : item.cost_price}
                                                            onChange={(e) => handleUpdateItemInline(item.id, "cost_price", e.target.value)}
                                                            className="h-8 w-24 text-xs px-2"
                                                            min="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrencyString(item.amount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8"
                                                                onClick={() => handleEditItem(item)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="danger"
                                                                className="h-8 w-8"
                                                                onClick={() => handleDeleteItem(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <Button
                            onClick={() => {
                                setEditingItemId(null);
                                setSelectedProduct("");
                                setSelectedProductObj(null);
                                setItemQuantity("1");
                                setIsItemDialogOpen(true);
                            }}
                            className="w-full"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {t("addItems") || "Add Items"}
                        </Button>
                    </div>

                    {/* Tax & Discount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t("discount") || "Discount"}</Label>
                            <div className="flex gap-2">
                                <NumericInput
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    placeholder="0"
                                />
                                <Select
                                    value={discountType}
                                    onValueChange={(val) =>
                                        setDiscountType(val as "percentage" | "fixed")
                                    }
                                >
                                    <SelectTrigger className="w-[100px]">
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
                            <Label>{t("tax") || "Tax"}</Label>
                            <div className="flex gap-2">
                                <NumericInput
                                    value={tax}
                                    onChange={(e) => setTax(e.target.value)}
                                    placeholder="0"
                                />
                                <Select
                                    value={taxType}
                                    onValueChange={(val) => setTaxType(val as "percentage" | "fixed")}
                                >
                                    <SelectTrigger className="w-[100px]">
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

                    {/* Summary */}
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                        <div className="flex justify-between text-sm">
                            <span>{t("subtotal") || "Subtotal"}:</span>
                            <span>{formatCurrencyString(calculations.subtotal)}</span>
                        </div>
                        {calculations.discountValue > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>{t("discount") || "Discount"}:</span>
                                <span>-{formatCurrencyString(calculations.discountValue)}</span>
                            </div>
                        )}
                        {calculations.taxValue > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>{t("tax") || "Tax"}:</span>
                                <span>{formatCurrencyString(calculations.taxValue)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>{t("totalAmount") || "Total Amount"}:</span>
                            <span>{formatCurrencyString(calculations.totalAmount)}</span>
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="is-paid"
                                checked={isPaid}
                                onCheckedChange={(checked) => {
                                    const val = checked as boolean;
                                    setIsPaid(val);
                                    if (val) {
                                        setPaidAmount(calculations.totalAmount.toString());
                                    } else {
                                        setPaidAmount("0");
                                    }
                                }}
                            />
                            <Label htmlFor="is-paid" className="cursor-pointer">
                                {t("marked") || "Mark as Paid"}
                            </Label>
                        </div>

                        {isPaid && (
                            <>
                                <div className="space-y-2">
                                    <Label>{t("paidAmount") || "Paid Amount"}</Label>
                                    <NumericInput
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        placeholder="0"
                                        className={Number(paidAmount || 0) > calculations.totalAmount ? "border-destructive text-destructive" : ""}
                                    />
                                    {Number(paidAmount || 0) > calculations.totalAmount && (
                                        <p className="text-xs text-destructive mt-1">
                                            {t("overpaymentError") || "Paid amount cannot exceed total amount"}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {/* <Label>{t("paymentMethod") || "Payment Method"}</Label>
                                    <Select
                                        value={selectedPaymentMethod}
                                        onValueChange={setSelectedPaymentMethod}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t("select") || "Select"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {paymentMethods.map((method) => {
                                                const label = method.bank_name || method.bankName || "Unknown";
                                                const details = method.bankDetails || "";
                                                const displayLabel = details ? `${label} (${details})` : label;
                                                const methodId = method._id || method.id || "";
                                                return (
                                                    <SelectItem key={methodId} value={methodId}>
                                                        {displayLabel}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select> */}
                                    <Label>{t("paymentMethod") || "Payment Method"}</Label>
                                    <PaymentMethodDropdown
                                        value={selectedPaymentMethod}
                                        onValueChange={(id) => setSelectedPaymentMethod(id)}
                                        placeholder={t("select") || "Select"}
                                        enableSearch={true}
                                        searchPlaceholder={tCommon("searchPaymentMethods") || "Search payment methods..."}
                                        noResultsText={tCommon("noPaymentMethodsFound") || "No payment methods found"}
                                        addButtonPosition="bottom"
                                        // includeDefaultMethods={true}
                                    />
                                </div>
                            </>
                        )}

                        <div className="flex justify-between font-bold text-lg pt-2">
                            <span>{t("balanceDue") || "Balance Due"}:</span>
                            <span className={calculations.balanceDue < 0 ? "text-destructive" : "text-green-600"}>
                                {formatCurrencyString(calculations.balanceDue)}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label>{t("description") || "Description"}</Label>
                        <Input
                            placeholder={t("addNote") || "Add Note"}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 justify-end">
                        {!editingBillId && (
                            <Button variant="outline">{t("saveNew") || "Save & New"}</Button>
                        )}
                        <Button
                            onClick={handleSaveBill}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingBillId ? t("update") || "Update" : t("save") || "Save"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Add Item Dialog */}
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingItemId ? t("editItem") : t("addItem")} {t("item") || "Item"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t("selectProduct") || "Select Product"}</Label>
                             <ProductDropdown
                                value={selectedProduct}
                                onValueChange={(value, product) => {
                                    setSelectedProduct(value);
                                    if (product) setSelectedProductObj(product);
                                }}
                                placeholder={t("selectProduct") || "Select Product"}
                                enableSearch={true}
                                addButtonPosition="top"
                                searchPlaceholder={t("searchProduct") || "Search product..."}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t("quantity") || "Quantity"}</Label>
                            <NumericInput
                                value={itemQuantity}
                                onChange={(e) => setItemQuantity(e.target.value)}
                                min="1"
                            />
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setIsItemDialogOpen(false)}
                            >
                                {t("cancel") || "Cancel"}
                            </Button>
                            <Button onClick={handleAddItem}>
                                {editingItemId ? t("update") : t("addItems")}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ErrorDialog
                open={errorDialog.open}
                onOpenChange={(open) =>
                    setErrorDialog((prev) => ({ ...prev, open }))
                }
                title={errorDialog.title}
                message={errorDialog.message}
                isSuccess={errorDialog.isSuccess}
            />
        </div>
    );
}

export default function AddPurchaseBillPage() {
    return (
        <Suspense fallback={<div className="h-[80vh] flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>}>
            <AddPurchaseBillPageInner />
        </Suspense>
    );
}