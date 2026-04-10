"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Loader2, X } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { formatCurrencyString } from "@/lib/utils";

interface Party {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  balance?: number;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  cost_price?: number;
  sell_price?: number;
  quantity?: number;
  in_stock?: number;
}

interface PaymentMethod {
  id: string;
  bankName: string;
  type?: string;
}

interface PurchaseBillItem {
  id: string;
  product_id: string;
  product_name: string;
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

export default function PurchaseBillPage() {
  const t = useTranslations("purchaseBill");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [selectedProduct, setSelectedProduct] = useState<string>("");
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
        const [partiesRes, productsRes, paymentMethodsRes] = await Promise.all([
          fetch(`/${locale}/api/customers`),
          fetch(`/${locale}/api/products`),
        fetch(`/${locale}/api/configuration/payment-method`)
        ]);

        if (partiesRes.ok) {
          const data = await partiesRes.json();
          setParties(Array.isArray(data) ? data : []);
        }

        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(Array.isArray(data) ? data : []);
        }

        if (paymentMethodsRes.ok) {
          const data = await paymentMethodsRes.json();
                  console.log('Payment Methods Data:', data);
          setPaymentMethods(Array.isArray(data) ? data : []);
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
  }, [locale, t]);

  const handlePartySelect = (id: number | string) => {
    const partyId = id.toString();
    setSelectedPartyId(partyId);
    const party = parties.find((p) => p.id === partyId);
    setSelectedPartyName(party?.name || "");
  };

  const calculations = useMemo(() => {
    const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0);

    const discountValue =
      discountType === "percentage"
        ? (subtotal * Number(discount || 0)) / 100
        : Number(discount || 0);

    const subtotalAfterDiscount = subtotal - discountValue;

    const taxValue =
      taxType === "percentage"
        ? (subtotalAfterDiscount * Number(tax || 0)) / 100
        : Number(tax || 0);

    const totalAmount = subtotalAfterDiscount + taxValue;
    const balanceDue = totalAmount - Number(paidAmount || 0);

    return {
      subtotal,
      discountValue,
      subtotalAfterDiscount,
      taxValue,
      totalAmount,
      balanceDue,
    };
  }, [billItems, discount, discountType, tax, taxType, paidAmount]);

  const handleAddItem = useCallback(() => {
    if (!selectedProduct) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("selectProduct"),
      });
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

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
          quantity,
          cost_price: costPrice,
          amount,
        },
      ]);
    }

    setSelectedProduct("");
    setItemQuantity("1");
    setIsItemDialogOpen(false);
  }, [selectedProduct, itemQuantity, editingItemId, billItems, products, t]);

  const handleEditItem = useCallback((item: PurchaseBillItem) => {
    setEditingItemId(item.id);
    setSelectedProduct(item.product_id);
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
        is_paid: isPaid,
        payment_method_id: selectedPaymentMethod,
        description,
      };

      const response = await fetch(`/${locale}/api/purchase-bills`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(billData),
      });

      if (!response.ok) {
        throw new Error(t("failedToSaveBill"));
      }

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("billSavedSuccess"),
        isSuccess: true,
      });

      // Reset form
      setSelectedPartyId("");
      setSelectedPartyName("");
      setBillItems([]);
      setDiscount("0");
      setTax("0");
      setIsPaid(false);
      setPaidAmount("0");
      setSelectedPaymentMethod("");
      setDescription("");
    } catch (error) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: error instanceof Error ? error.message : t("failedToSaveBill"),
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
    locale,
    t,
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {t("title") || "Purchase Bill"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("purchaseBilldescription") || "Create and manage purchase bills"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("billDetails") || "Bill Details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Party Selection */}
          <div className="space-y-2">
            <Label htmlFor="party">{t("partyName") || "Party Name"} *</Label>
            <Combobox
              items={parties.map((p) => ({
                id: p.id,
                name: p.name,
                description: p.phone || p.email || "",
              }))}
              placeholder={t("selectParty") || "Select a party"}
              onSelect={handlePartySelect}
              value={selectedPartyName}
            />
          </div>

          {/* Billed Items */}
          <div className="space-y-3">
            <Label>{t("billedItems") || "Billed Items"} *</Label>
            <div className="border rounded-lg divide-y">
              {billItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t("noItems") || "No items added"}
                </div>
              ) : (
                billItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50"
                  >
                    <div>
                      <div className="font-medium">#{idx + 1}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.product_name}
                      </div>
                      <div className="text-xs">
                        {item.quantity} × {formatCurrencyString(item.cost_price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">
                        {formatCurrencyString(item.amount)}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditItem(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button
              onClick={() => {
                setEditingItemId(null);
                setSelectedProduct("");
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
                <Input
                  type="number"
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
                <Input
                  type="number"
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
                onCheckedChange={(checked) => setIsPaid(checked as boolean)}
              />
              <Label htmlFor="is-paid" className="cursor-pointer">
                {t("marked") || "Mark as Paid"}
              </Label>
            </div>

            {isPaid && (
              <>
                <div className="space-y-2">
                  <Label>{t("paidAmount") || "Paid Amount"}</Label>
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("paymentMethod") || "Payment Method"}</Label>
                  <Select
                    value={selectedPaymentMethod}
                    onValueChange={setSelectedPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("select") || "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.bankName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex justify-between font-bold text-lg pt-2">
              <span>{t("balanceDue") || "Balance Due"}:</span>
              <span className="text-green-600">
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
            <Button variant="outline">{t("saveNew") || "Save & New"}</Button>
            <Button
              onClick={handleSaveBill}
              disabled={isSaving}
            //   className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("save") || "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItemId ? t("editItem") : t("addItem")} {t("item") || "Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("selectProduct") || "Select Product"}</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("selectProduct") || "Select Product"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} (
                      {formatCurrencyString(product.cost_price || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("quantity") || "Quantity"}</Label>
              <Input
                type="number"
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
              <Button onClick={handleAddItem} >
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

