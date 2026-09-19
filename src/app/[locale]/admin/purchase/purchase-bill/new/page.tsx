"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import { ItemSelectTable } from "@/components/invoice/item-select-table";
import { type POSProduct, type Product } from "@/app/[locale]/admin/sales/invoice/new/page";
import { calculateLineTotal } from "@/lib/invoice/calculations";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";
import { generateReferenceNumber } from "@/lib/utils";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

const getTodayDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

type Party = {
  id: string | number;
  _id?: string | number;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  type?: string;
};

function AddPurchaseBillPageInner() {
  const t = useTranslations("purchaseBill");
  const tInvoice = useTranslations("invoice");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBillId = searchParams.get("id") || searchParams.get("edit");
  const locale = useLocale();
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [selectedPartyName, setSelectedPartyName] = useState<string>("");
  const [purchaseNumber, setPurchaseNumber] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);

  const [discount, setDiscount] = useState<string>("0");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [tax, setTax] = useState<string>("0");
  const [taxType, setTaxType] = useState<"percentage" | "fixed">("fixed");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<number | "">("");
  const [description, setDescription] = useState<string>("");

  const [saveError, setSaveError] = useState<string>("");
  const [showSaveErrorDialog, setShowSaveErrorDialog] = useState(false);

  useEffect(() => {
    const loadBillData = async () => {
      if (editBillId) {
        try {
          const bill = await db.purchase_bills.get(editBillId);
          if (bill) {
            setEditingId(bill.id || bill._id || editBillId);
            setPurchaseNumber(
              bill.purchase_number ||
                bill.purchase_no ||
                bill.bill_number ||
                generateReferenceNumber("PUR")
            );
            setSelectedPartyId(String(bill.party_id || bill.partyId || ""));
            setSelectedPartyName(bill.party_name || bill.partyName || "");

            if (bill.created_at) {
              const dt = bill.created_at.split("T")[0];
              setSelectedDate(dt || getTodayDateString());
            } else {
              setSelectedDate(getTodayDateString());
            }

            let items = bill.items;
            if (typeof items === "string") {
              try {
                items = JSON.parse(items);
              } catch (e) {}
            }

            if (items && Array.isArray(items)) {
              const formattedItems: POSProduct[] = items.map((item: any) => {
                const qty = Number(item.quantity ?? 1);
                const cost = Number(item.cost_price ?? item.price ?? item.sell_price ?? 0);
                return {
                  id: item.product_id || item.id,
                  name: item.product_name || item.name || "",
                  description: item.product_description || item.description || "",
                  quantity: qty,
                  quantityInput: String(qty),
                  sell_price: cost,
                  sellPriceInput: String(cost),
                  unit_of_measurement: item.unit_of_measurement || "",
                  hadNoUomOriginally:
                    !item.unit_of_measurement ||
                    item.unit_of_measurement === "-" ||
                    item.unit_of_measurement === "none",
                  discount: item.discount || 0,
                  discountType: item.discountType || "value",
                };
              });
              setSelectedProducts(formattedItems);
            }

            setDiscount(bill.discount?.toString() || "0");
            setDiscountType(bill.discount_type || bill.discountType || "fixed");
            setTax(bill.tax?.toString() || "0");
            setTaxType(bill.tax_type || bill.taxType || "fixed");

            if (bill.paid_amount && bill.paid_amount > 0) {
              setPaidAmount(bill.paid_amount);
            } else {
              setPaidAmount("");
            }

            setPaymentMethod(bill.payment_method_id || bill.paymentMethodId || "");
            setDescription(bill.description || "");
          }
        } catch (error) {
          console.error("Error loading purchase bill for edit:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setPurchaseNumber(generateReferenceNumber("PUR"));
        setLoading(false);
      }
    };

    loadBillData();
  }, [editBillId]);

  const generateNewPurchaseNo = () => {
    setPurchaseNumber(generateReferenceNumber("PUR"));
  };

  const handleClear = () => {
    setSelectedProducts([]);
    setSelectedPartyId("");
    setSelectedPartyName("");
    generateNewPurchaseNo();
    setSelectedDate(getTodayDateString());
    setDiscount("0");
    setDiscountType("fixed");
    setTax("0");
    setTaxType("fixed");
    setPaidAmount("");
    setPaymentMethod("");
    setDescription("");
    setSaveError("");
  };

  // Calculations
  const subtotal = useMemo(() => {
    return selectedProducts.reduce((sum, product) => sum + calculateLineTotal(product), 0);
  }, [selectedProducts]);

  const calculations = useMemo(() => {
    const discountNum = Math.max(0, parseFloat(discount || "0") || 0);
    const taxNum = Math.max(0, parseFloat(tax || "0") || 0);

    const discountValue =
      discountType === "percentage"
        ? (subtotal * Math.min(discountNum, 100)) / 100
        : Math.min(discountNum, subtotal);

    const subtotalAfterDiscount = Math.max(0, subtotal - discountValue);

    const taxValue =
      taxType === "percentage"
        ? (subtotalAfterDiscount * Math.min(taxNum, 100)) / 100
        : taxNum;

    const totalAmount = Math.max(0, subtotalAfterDiscount + taxValue);
    const paidNum = paidAmount === "" ? 0 : Math.max(0, Number(paidAmount));
    const balanceDue = Math.max(0, totalAmount - paidNum);

    return {
      subtotal,
      discountValue,
      subtotalAfterDiscount,
      taxValue,
      totalAmount,
      balanceDue,
    };
  }, [subtotal, discount, discountType, tax, taxType, paidAmount]);

  // Product Selection & Row updates
  const handleSelectProduct = (product: Product) => {
    if (!product) return;
    setSaveError("");

    const productId = product.id || (product as any)._id;
    const costPrice =
      product.cost_price !== undefined &&
      product.cost_price !== null &&
      String(product.cost_price).trim() !== ""
        ? Number(product.cost_price)
        : Number(product.price ?? product.sell_price ?? 0);

    const hadNoUom =
      !product.unit_of_measurement ||
      product.unit_of_measurement.trim() === "" ||
      product.unit_of_measurement === "-" ||
      product.unit_of_measurement === "none";

    const existing = selectedProducts.find((item) => String(item.id) === String(productId));

    if (existing) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          String(p.id) === String(productId)
            ? {
                ...p,
                quantity: p.quantity + 1,
                quantityInput: String(p.quantity + 1),
              }
            : p
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          ...product,
          id: productId,
          quantity: 1,
          quantityInput: "1",
          quantityType: "prime",
          sell_price: costPrice,
          sellPriceInput: String(costPrice),
          discount: 0,
          discountType: "value",
          discountInput: "0",
          hadNoUomOriginally: hadNoUom,
          unit_of_measurement: product.unit_of_measurement || "",
        },
      ]);
    }
  };

  const handleRowProductChange = (
    oldId: number | string,
    newProduct: Product,
    isSync?: boolean
  ) => {
    if (!newProduct) return;
    const hadNoUom =
      !newProduct.unit_of_measurement ||
      newProduct.unit_of_measurement.trim() === "" ||
      newProduct.unit_of_measurement === "-" ||
      newProduct.unit_of_measurement === "none";

    setSelectedProducts((current) =>
      current.map((p) => {
        if (p.id === oldId) {
          const isSameProduct = isSync || p.name === newProduct.name;
          const newCost =
            newProduct.cost_price !== undefined &&
            newProduct.cost_price !== null &&
            String(newProduct.cost_price).trim() !== ""
              ? Number(newProduct.cost_price)
              : Number(newProduct.price ?? newProduct.sell_price ?? 0);

          return {
            ...p,
            id: newProduct.id || (newProduct as any)._id || p.id,
            name: newProduct.name,
            description: newProduct.description,
            unit_of_measurement: newProduct.unit_of_measurement || "",
            hadNoUomOriginally: hadNoUom,
            ...(isSameProduct
              ? {}
              : {
                  sell_price: newCost,
                  sellPriceInput: String(newCost),
                }),
          };
        }
        return p;
      })
    );
  };

  const handleQuantityChange = (id: number | string, rawVal: string) => {
    setSelectedProducts((current) =>
      current.map((p) => {
        if (p.id === id) {
          const parsed = parseFloat(rawVal);
          const validQty = isNaN(parsed) ? p.quantity : Math.max(0, parsed);
          return {
            ...p,
            quantityInput: rawVal,
            quantity: rawVal.trim() === "" ? p.quantity : validQty,
          };
        }
        return p;
      })
    );
  };

  const handleQuantityBlur = (id: number | string) => {
    setSelectedProducts((current) =>
      current.map((p) => {
        if (p.id === id) {
          const valid =
            p.quantityInput?.trim() && !isNaN(parseFloat(p.quantityInput))
              ? p.quantityInput
              : String(p.quantity || 1);
          return {
            ...p,
            quantityInput: valid,
            quantity: Math.max(0, parseFloat(valid) || 1),
          };
        }
        return p;
      })
    );
  };

  const handleCostPriceChange = (id: number | string, rawVal: string) => {
    setSelectedProducts((current) =>
      current.map((p) => {
        if (p.id === id) {
          const parsed = parseFloat(rawVal);
          const validCost = isNaN(parsed) ? 0 : Math.max(0, parsed);
          return {
            ...p,
            sellPriceInput: rawVal,
            sell_price: validCost,
          };
        }
        return p;
      })
    );
  };

  const handleCostPriceBlur = (id: number | string) => {
    setSelectedProducts((current) =>
      current.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            sellPriceInput: String(p.sell_price),
          };
        }
        return p;
      })
    );
  };

  const handleUomChange = (id: number | string, newUom: string) => {
    setSelectedProducts((current) =>
      current.map((p) => (p.id === id ? { ...p, unit_of_measurement: newUom } : p))
    );
  };

  const handleRemoveProduct = (id: number | string) => {
    const target = selectedProducts.find((p) => p.id === id);
    if (!target) return;

    if (target.quantity > 1) {
      handleQuantityChange(id, String(target.quantity - 1));
      return;
    }

    setSelectedProducts(selectedProducts.filter((p) => p.id !== id));
    setSaveError("");
  };

  // Save Bill
  const handleSaveBill = async () => {
    if (!selectedPartyId || selectedProducts.length === 0) {
      setSaveError(
        !selectedPartyId
          ? t("selectParty") || "Please select a supplier / party"
          : t("addItems") || "Please add at least one item"
      );
      setShowSaveErrorDialog(true);
      return;
    }

    const currentPaid = paidAmount === "" ? 0 : Number(paidAmount);
    if (currentPaid > Math.floor(calculations.totalAmount)) {
      setSaveError(t("overpaymentError") || "Paid amount cannot exceed total amount");
      setShowSaveErrorDialog(true);
      return;
    }

    if (currentPaid > 0 && !paymentMethod) {
      setSaveError(
        t("paymentMethodRequired") ||
          tInvoice("paymentMethodRequired") ||
          "Payment Method is required"
      );
      setShowSaveErrorDialog(true);
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const localBillId = editingId || `local_pb_${Date.now()}`;
      const finalPurchaseNo = purchaseNumber || generateReferenceNumber("PUR");
      const { adjustOfflineStock } = await import("@/lib/db/offline-stock-manager");

      const finalPaidAmount = currentPaid;
      const finalBalanceDue = Math.max(0, calculations.totalAmount - finalPaidAmount);
      const isPaid = finalBalanceDue === 0;

      // 1. If editing, revert old stock and old balance
      if (editingId) {
        const oldBill = await db.purchase_bills.get(editingId);
        if (oldBill) {
          if (oldBill.balance_due !== undefined) {
            await updateOfflinePartyBalance(oldBill.party_id, oldBill.balance_due);
          }
          if (oldBill.items && Array.isArray(oldBill.items)) {
            for (const item of oldBill.items) {
              if (item.product_id) {
                await adjustOfflineStock(
                  String(item.product_id),
                  -(Number(item.quantity) || 0)
                );
              }
            }
          }
        }
      }

      // 2. Prepare bill payload
      const billData: any = {
        id: localBillId,
        purchase_number: finalPurchaseNo,
        purchase_no: finalPurchaseNo,
        bill_number: finalPurchaseNo,
        party_id: selectedPartyId,
        party_name: selectedPartyName,
        items: selectedProducts.map((p) => ({
          product_id: String(p.id),
          product_name: p.name,
          product_description: p.description || "",
          quantity: p.quantity,
          cost_price: p.sell_price,
          amount: calculateLineTotal(p),
          unit_of_measurement: p.unit_of_measurement,
        })),
        discount: Number(discount || 0),
        discount_type: discountType,
        tax: Number(tax || 0),
        tax_type: taxType,
        total_amount: calculations.totalAmount,
        paid_amount: finalPaidAmount,
        balance_due: finalBalanceDue,
        is_paid: isPaid,
        payment_method_id: paymentMethod || null,
        description: description || null,
        user_id: (session?.user as any)?.id || "",
        created_at: selectedDate ? new Date(selectedDate).toISOString() : now,
        updated_at: now,
      };

      // 3. Save to local IndexedDB
      if (editingId) {
        await db.purchase_bills.put(billData);
      } else {
        await db.purchase_bills.add(billData);
      }

      // 4. Update offline party balance (negative for purchase bill debit)
      await updateOfflinePartyBalance(selectedPartyId, -finalBalanceDue);

      // 5. Update offline stock (+ for purchase increment) & save UOM if changed
      for (const p of selectedProducts) {
        if (p.id) {
          await adjustOfflineStock(String(p.id), Number(p.quantity) || 0);

          const productDoc = await db.products.get(String(p.id));
          if (
            productDoc &&
            p.unit_of_measurement &&
            (!productDoc.unit_of_measurement ||
              productDoc.unit_of_measurement === "-" ||
              productDoc.unit_of_measurement === "none" ||
              p.hadNoUomOriginally)
          ) {
            await db.products.update(String(p.id), {
              unit_of_measurement: p.unit_of_measurement,
            });
            await SyncEngine.queueOperation(
              "products",
              "PUT",
              `/api/products/${p.id}`,
              { unit_of_measurement: p.unit_of_measurement },
              String(p.id)
            );
          }
        }
      }

      // 6. Queue sync operation for backend
      const syncMethod = editingId ? "PUT" : "POST";
      await SyncEngine.queueOperation(
        "purchase_bills",
        syncMethod,
        `/${locale}/api/purchase-bills`,
        billData,
        !editingId ? localBillId : editingId
      );

      // 7. Navigate back to listing page
      router.push(`/${locale}/admin/purchase/purchase-bill`);
    } catch (error: any) {
      console.error("Error saving purchase bill:", error);
      setSaveError(error?.message || "Failed to save purchase bill");
      setShowSaveErrorDialog(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3 bg-white p-3 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/admin/purchase/purchase-bill`)}
            className="shrink-0 h-8 w-8 text-gray-500 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingId
                ? t("editBill") || "Edit Purchase Bill"
                : t("title") || "Create Purchase Bill"}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {editingId
                ? t("billsEdit") || "Modify the details of this purchase bill"
                : t("purchaseBilldescription") || "Supplier se purchase bill banayein aur manage karein"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:flex items-center gap-1.5 sm:gap-2 w-full md:w-auto mt-2 md:mt-0">
          <Button
            variant="outline"
            className="w-full text-[10px] sm:text-xs h-8 px-1 sm:px-3 md:w-auto"
            onClick={handleClear}
          >
            <span className="text-gray-600">{tCommon("clear") || "Clear"}</span>
          </Button>
          <Button
            onClick={handleSaveBill}
            disabled={isSaving}
            className="w-full text-[10px] sm:text-xs h-8 px-1 sm:px-3 md:w-auto bg-primary text-white hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
                {t("saving") || tCommon("saving") || "Saving..."}
              </>
            ) : editingId ? (
              t("update") || "Update"
            ) : (
              t("save") || "Save"
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        {/* Main Content (Left Column) */}
        <div className="xl:col-span-3 space-y-2">
          {/* Section 1: Supplier & Bill Details */}
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                1
              </div>
              <CardTitle className="text-lg m-0">
                {t("billDetails") || "Supplier & Bill Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="space-y-3">
                  <Label htmlFor="party" className="text-xs font-semibold text-gray-700">
                    {t("partyName") || "Supplier / Party"} <span className="text-red-500">*</span>
                  </Label>
                  <div>
                    <PartyDropdown
                      value={selectedPartyId}
                      onValueChange={(val, party) => {
                        setSelectedPartyId(val);
                        setSelectedPartyName(party?.name || "");
                        setSaveError("");
                      }}
                      placeholder={t("selectParty") || "Select supplier / party"}
                      className="w-full h-8 text-xs"
                      filterActiveOnly={true}
                      enableSearch={true}
                      searchPlaceholder={t("searchParty") || "Search supplier / party..."}
                      autoSelectCash={false}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="purchase-number" className="text-xs font-semibold text-gray-700">
                    {t("purchaseNo") || "Purchase / Bill No"}
                  </Label>
                  <Input
                    id="purchase-number"
                    type="text"
                    value={purchaseNumber}
                    onChange={(e) => setPurchaseNumber(e.target.value)}
                    placeholder="PUR-001"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="bill-date" className="text-xs font-semibold text-gray-700">
                    {t("date") || "Bill Date"} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={selectedDate}
                    onChange={(val) => setSelectedDate(val)}
                    placeholder="DD-MM-YYYY"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Items Add Karein */}
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                2
              </div>
              <CardTitle className="text-lg m-0">
                {t("addItems") || "Items Add Karein"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 p-0 md:p-3 md:pt-3">
              <ItemSelectTable
                selectedProducts={selectedProducts}
                handleQuantityChange={handleQuantityChange}
                handleQuantityBlur={handleQuantityBlur}
                handleSellPriceChange={handleCostPriceChange}
                handleSellPriceBlur={handleCostPriceBlur}
                handleUomChange={handleUomChange}
                handleRemoveProduct={handleRemoveProduct}
                handleSelectProduct={handleSelectProduct}
                handleRowProductChange={handleRowProductChange}
                priceLabel={tInvoice("sellPrice") || "Price/Unit"}
                showQtyType={false}
                showDiscount={false}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Section 3: Notes (Optional) */}
            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
                <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <CardTitle className="text-lg m-0">
                  {t("notesOptional") || "Notes (Optional)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <textarea
                  placeholder={t("addNote") || "Koi note likhein..."}
                  className="w-full min-h-[60px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-3">
                  {t("notePrintMessage") || "Yeh note purchase bill par save hoga"}
                </p>
              </CardContent>
            </Card>

            {/* Section 4: Total Aur Payment */}
            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
              <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
                <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <CardTitle className="text-lg m-0">
                  {t("totalAurPayment") || "Total Aur Payment"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-600 font-medium">
                      {t("subtotal") || "Sub Total"}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      Rs. {Math.round(calculations.subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-600 font-medium w-1/3">
                      {t("discount") || "Discount"}
                    </span>
                    <div className="flex gap-3 w-2/3">
                      <NumericInput
                        placeholder="0"
                        className="flex-1 h-8 text-xs"
                        value={discount || ""}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                      <Select
                        value={discountType}
                        onValueChange={(val) =>
                          setDiscountType(val as "percentage" | "fixed")
                        }
                      >
                        <SelectTrigger className="w-24 h-8 text-xs bg-white">
                          <SelectValue placeholder="PKR" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed" className="text-xs">
                            PKR
                          </SelectItem>
                          <SelectItem value="percentage" className="text-xs">
                            %
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-xs text-gray-600 font-medium w-1/3">
                      {t("tax") || "Tax"}
                    </span>
                    <div className="flex gap-3 w-2/3">
                      <NumericInput
                        placeholder="0"
                        className="flex-1 h-8 text-xs"
                        value={tax || ""}
                        onChange={(e) => setTax(e.target.value)}
                      />
                      <Select
                        value={taxType}
                        onValueChange={(val) =>
                          setTaxType(val as "percentage" | "fixed")
                        }
                      >
                        <SelectTrigger className="w-24 h-8 text-xs bg-white">
                          <SelectValue placeholder="PKR" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed" className="text-xs">
                            PKR
                          </SelectItem>
                          <SelectItem value="percentage" className="text-xs">
                            %
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-lg border border-blue-100 mt-3">
                    <span className="text-primary font-bold text-sm">
                      {t("totalAmount") || "Total Amount"}
                    </span>
                    <span className="text-primary font-bold text-base">
                      Rs. {Math.floor(calculations.totalAmount)}
                    </span>
                  </div>

                  <div className="space-y-2 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 font-medium w-1/3">
                        {t("paymentMethod") || "Payment Method"}
                      </span>
                      <div className="w-2/3">
                        <PaymentMethodDropdown
                          value={paymentMethod}
                          onValueChange={setPaymentMethod}
                          placeholder="Cash in Hand"
                          defaultToCash={true}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 font-medium w-1/3">
                        {t("paidAmount") || "Paid Amount"}
                      </span>
                      <NumericInput
                        value={paidAmount === "" ? "" : paidAmount}
                        onChange={(e) => {
                          const val =
                            e.target.value === "" ? "" : Number(e.target.value);
                          if (
                            val !== "" &&
                            val > Math.floor(calculations.totalAmount)
                          ) {
                            setSaveError(
                              t("overpaymentError") ||
                                "Paid amount cannot exceed total amount"
                            );
                            setShowSaveErrorDialog(true);
                            setPaidAmount(Math.floor(calculations.totalAmount));
                          } else {
                            setPaidAmount(val);
                          }
                        }}
                        placeholder="0"
                        className="w-2/3 h-8 text-xs font-semibold"
                      />
                    </div>

                    {paidAmount !== "" && Number(paidAmount) > 0 && (
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                        <span className="text-xs text-gray-600 font-medium">
                          {t("balanceDue") || "Balance Due"}
                        </span>
                        <span className="text-xs font-semibold text-gray-900">
                          Rs.{" "}
                          {Math.max(
                            0,
                            Math.floor(calculations.totalAmount) -
                              Number(paidAmount)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar (Right Column) */}
        <div className="xl:col-span-1 space-y-2">
          <Card className="shadow-sm border-0 ring-1 ring-gray-200 sticky top-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {t("billSummary") || "Purchase Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("items") || "Items"}</span>
                  <span className="font-medium text-gray-900">
                    {selectedProducts.length}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("totalQuantity") || "Total Quantity"}</span>
                  <span className="font-medium text-gray-900">
                    {selectedProducts.reduce((sum, p) => sum + (p.quantity || 1), 0)}
                  </span>
                </div>

                <div className="h-px bg-gray-100 my-4"></div>

                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("subtotal") || "Sub Total"}</span>
                  <span className="font-medium text-gray-900">
                    Rs. {Math.round(calculations.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("discount") || "Discount"}</span>
                  <span className="font-medium text-gray-900">
                    Rs. {Math.round(calculations.discountValue)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("tax") || "Tax"}</span>
                  <span className="font-medium text-gray-900">
                    Rs. {Math.round(calculations.taxValue)}
                  </span>
                </div>

                <div className="h-px bg-gray-100 my-4"></div>

                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-900">
                    {t("totalAmount") || "Total Amount"}
                  </span>
                  <span className="font-bold text-lg text-primary">
                    Rs. {Math.floor(calculations.totalAmount)}
                  </span>
                </div>

                {paidAmount !== "" && Number(paidAmount) > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-gray-600 mb-2">
                      <span>{t("paidAmount") || "Paid Amount"}</span>
                      <span className="font-medium text-gray-900">
                        Rs. {Number(paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-primary font-bold">
                      <span>{t("balanceDue") || "Balance Due"}</span>
                      <span>
                        Rs.{" "}
                        {Math.max(
                          0,
                          Math.floor(calculations.totalAmount) -
                            Number(paidAmount)
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3 mb-3 text-primary font-semibold">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2v1" />
                    <path d="M12 7v1" />
                    <path d="M12 12v1" />
                    <path d="M12 17v1" />
                    <path d="M4 12h1" />
                    <path d="M9 12h1" />
                    <path d="M14 12h1" />
                    <path d="M19 12h1" />
                    <path d="M6 7l1 1" />
                    <path d="M9 10l1 1" />
                    <path d="M14 15l1 1" />
                    <path d="M17 18l1 1" />
                    <path d="M6 17l1-1" />
                    <path d="M9 14l1-1" />
                    <path d="M14 9l1-1" />
                    <path d="M17 6l1-1" />
                  </svg>
                  {t("tipTitle") || "Asaan Tip"}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {t("tipDescription") ||
                    "Pehle Supplier / Party select karein, phir items add karein aur Save Bill par click karein."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Show error in modal dialog */}
      <ErrorDialog
        open={showSaveErrorDialog}
        onOpenChange={setShowSaveErrorDialog}
        title={t("error") || "Error"}
        message={saveError}
      />
    </div>
  );
}

export default function AddPurchaseBillPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[80vh] flex items-center justify-center">
          <Loader2Icon className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <AddPurchaseBillPageInner />
    </Suspense>
  );
}