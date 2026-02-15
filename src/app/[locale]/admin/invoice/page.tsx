"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoicePreviewDialog } from "@/components/invoice/invoice-preview-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { calculateLineTotal } from "@/lib/invoice/calculations";

type Product = {
  id: number | string;
  name: string;
  description?: string;
  sell_price: number;
  unit_of_measurement?: string;
  quantity?: number;
  in_stock?: number;
  damaged_quantity?: number;
  type?: string;
};

type Customer = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

interface POSProduct extends Product {
  quantity: number;
  quantityType?: "prime" | "damaged";
  discount?: number;
  discountType?: "value" | "percentage";
  discountInput?: string;
}

export default function InvoicePage() {
  const t = useTranslations("invoice");
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [addDueDate, setAddDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [charges, setCharges] = useState<
    Array<{ id: string; item: string; value: number }>
  >([]);
  const [showAddCharge, setShowAddCharge] = useState<boolean>(false);
  const [newChargeItem, setNewChargeItem] = useState<string>("");
  const [newChargeValue, setNewChargeValue] = useState<string>("");
  const [showInvoicePreview, setShowInvoicePreview] = useState<boolean>(false);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [overallDiscountType, setOverallDiscountType] = useState<
    "value" | "percentage"
  >("value");
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [showOverstockDialog, setShowOverstockDialog] = useState(false);
  const [overstockItems, setOverstockItems] = useState<
    { name: string; requested: number; inStock: number }[]
  >([]);

  const getSalePrice = (product: POSProduct) => product.sell_price;
  const formatUom = (uom?: string) =>
    uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-";
  const truncateDescription = (desc?: string, limit = 100) => {
    if (!desc) return "";
    return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
  };

  useEffect(() => {
    generateInvoiceNo();
    fetchProducts();
    fetchCustomers();
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    setCustomerNotes((prev) =>
      prev === "" ? t("thanksForYourBusiness") : prev,
    );
  }, [t]);

  const generateInvoiceNo = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    setInvoiceNo(`INV-${timestamp}-${random}`);
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error(t("failedToFetchCustomers"));
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch("/api/payment-methods");
      if (!response.ok) throw new Error(t("failedToFetchPaymentMethods"));
      const data = await response.json();
      setPaymentMethods(data);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  };

  const handleSelectProduct = (productId: number | string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (selectedProducts.some((p) => p.id === productId)) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.id === productId ? { ...p, quantity: p.quantity + 1 } : p,
        ),
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          ...product,
          quantity: 1,
          quantityType: "prime",
          discount: 0,
          discountType: "value",
          discountInput: "0",
        },
      ]);
    }
  };

  const handleSelectCustomer = (customerId: number | string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
    }
  };

  const handleSelectPaymentMethod = (paymentMethodId: number | string) => {
    const method = paymentMethods.find((pm) => pm.id === paymentMethodId);
    if (method) {
      setPaymentMethod(method);
    }
  };

  const handleQuantityChange = (productId: number | string, newQuantity: number) => {
    const safeQty =
      Number.isNaN(newQuantity) || newQuantity < 0
        ? (selectedProducts.find((p) => p.id === productId)?.quantity ?? 1)
        : newQuantity;
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, quantity: safeQty } : p,
      ),
    );
  };

  const handleDiscountChange = (productId: number | string, newDiscount: number) => {
    const safeDiscount = Number.isNaN(newDiscount)
      ? 0
      : Math.max(0, newDiscount);
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, discount: safeDiscount } : p,
      ),
    );
  };

  const handleDiscountTypeChange = (
    productId: number | string,
    newType: "value" | "percentage",
  ) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, discountType: newType } : p,
      ),
    );
  };

  const handleQuantityTypeChange = (
    productId: number | string,
    newType: "prime" | "damaged",
  ) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, quantityType: newType } : p,
      ),
    );
  };

  const handleSellPriceChange = (productId: number | string, newSellPrice: number) => {
    const safePrice = Number.isNaN(newSellPrice)
      ? 0
      : Math.max(0, newSellPrice);
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, sell_price: safePrice } : p,
      ),
    );
  };

  const handleRemoveProduct = (productId: number | string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
  };

  const total = selectedProducts.reduce(
    (sum, product) => sum + calculateLineTotal(product),
    0,
  );

  const handleAddNewCharge = () => {
    if (newChargeItem.trim() && newChargeValue) {
      setCharges([
        ...charges,
        {
          id: Date.now().toString(),
          item: newChargeItem,
          value: parseFloat(newChargeValue) || 0,
        },
      ]);
      setNewChargeItem("");
      setNewChargeValue("");
    }
  };

  const handleChargeChange = (
    id: string,
    field: "item" | "value",
    val: string | number,
  ) => {
    setCharges(
      charges.map((charge) =>
        charge.id === id
          ? {
              ...charge,
              [field]:
                field === "value" ? parseFloat(val.toString()) || 0 : val,
            }
          : charge,
      ),
    );
  };

  const handleRemoveCharge = (id: string) => {
    setCharges(charges.filter((charge) => charge.id !== id));
  };

  const pendingCharge =
    newChargeItem.trim() || newChargeValue
      ? {
          id: "pending",
          item: newChargeItem.trim() || t("adjustment"),
          value: parseFloat(newChargeValue) || 0,
        }
      : null;
  const displayCharges = pendingCharge ? [...charges, pendingCharge] : charges;

  const chargesTotal = displayCharges.reduce(
    (sum, charge) => sum + charge.value,
    0,
  );
  const overallDiscountNum = overallDiscount || 0;
  const overallDiscountAmount =
    overallDiscountType === "percentage"
      ? Math.round((total * overallDiscountNum) / 100)
      : overallDiscountNum;
  const shippingChargesNum = shippingCharges || 0;
  const finalTotal = Math.max(
    0,
    total -
      Math.min(overallDiscountAmount, total) +
      shippingChargesNum +
      chargesTotal,
  );

  const handleSaveOrder = () => {
    if (!selectedCustomer || selectedProducts.length === 0 || !invoiceNo) {
      return;
    }

    // Check for products exceeding available stock (only for goods type)
    const items: { name: string; requested: number; inStock: number }[] = [];
    for (const selected of selectedProducts) {
      const product = products.find(
        (p) =>
          String(p.id) === String(selected.id) || p.id === selected.id,
      );
      const isGoods =
        !product?.type || product.type === "goods" || product.type === "good";
      if (!isGoods) continue;

      const isDamaged = selected.quantityType === "damaged";
      const availableStock = isDamaged
        ? ((product?.damaged_quantity ?? 0) as number)
        : ((product?.quantity ?? product?.in_stock ?? 0) as number);
      const requestedQty = selected.quantity ?? 1;
      if (requestedQty > availableStock) {
        items.push({
          name: selected.name,
          requested: requestedQty,
          inStock: availableStock,
        });
      }
    }

    if (items.length > 0) {
      setOverstockItems(items);
      setShowOverstockDialog(true);
      return;
    }

    setShowInvoicePreview(true);
  };

  const handleOverstockConfirm = () => {
    setShowOverstockDialog(false);
    setOverstockItems([]);
    setShowInvoicePreview(true);
  };

  const handleOverstockCancel = () => {
    setOverstockItems([]);
  };

  const handleCreateOrder = async (paymentDetails: {
    paymentMethod: string;
    paidAmount: number;
    paidDate: string | null;
    noPaymentAtAll: boolean;
  }) => {
    if (!selectedCustomer || selectedProducts.length === 0 || !invoiceNo) {
      return;
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNo,
          customerId: selectedCustomer.id,
          saleDate: selectedDate,
          dueDate: addDueDate ? dueDate : null,
          products: selectedProducts.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            quantity: p.quantity,
            quantityType: p.quantityType || "prime",
            price: p.sell_price,
            discount: p.discount || 0,
            discountType: p.discountType || "value",
            unit_of_measurement: p.unit_of_measurement,
          })),
          subtotal: total,
          charges: displayCharges.map((c) => ({
            item: c.item,
            value: c.value,
          })),
          overallDiscount: overallDiscountAmount,
          shippingCharges: shippingChargesNum,
          total: finalTotal,
          payment: {
            method: paymentDetails.paymentMethod,
            paidAmount: paymentDetails.paidAmount,
            paidDate: paymentDetails.paidDate,
            noPaymentAtAll: paymentDetails.noPaymentAtAll,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to create order");

      const order = await response.json();

      // Refetch products to sync stock with inventory
      fetchProducts();

      // Reset the form
      setSelectedProducts([]);
      setSelectedCustomer(null);
      setInvoiceNo("");
      setSelectedDate(new Date().toISOString().split("T")[0]);
      setAddDueDate(false);
      setDueDate(new Date().toISOString().split("T")[0]);
      setCharges([]);
      setShowAddCharge(false);
      setShowInvoicePreview(false);
    } catch (error) {
      console.error("Error creating order:", error);
    }
  };

  return (
    <div className="container mx-auto p-0">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("pageDescription")}
          </p>
        </div>
      </div>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("saleDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            {/* Invoice No & Generate Button */}
            <div className="md:col-span-2">
              <Label htmlFor="invoice-no" className="text-xs font-medium">
                {t("invoiceNo")}
              </Label>
              <Input
                id="invoice-no"
                placeholder={t("enterGenerate")}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* Customer Selection */}
            <div className="md:col-span-3">
              <Label htmlFor="customer" className="text-xs font-medium">
                {t("customer")}
              </Label>
              <Combobox
                items={customers}
                placeholder={t("selectCustomer")}
                onSelect={handleSelectCustomer}
              />
            </div>

            {/* Sale Date */}
            <div className="md:col-span-2">
              <Label htmlFor="sale-date" className="text-xs font-medium">
                {t("saleDate")}
              </Label>
              <Input
                id="sale-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="h-8 text-sm"
              />
            </div>

            {/* Add Due Date Switch & Due Date */}
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="add-due-date"
                checked={addDueDate}
                onChange={(e) => setAddDueDate(e.target.checked)}
                className="w-3 h-3 rounded"
              />
              <Label
                htmlFor="add-due-date"
                className="text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                Add Due Date
              </Label>
            </div>

            {/* Due Date Input - Conditional */}
            {addDueDate && (
              <div className="md:col-span-2">
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("items")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("item")}</TableHead>
                  <TableHead>{t("sellPrice")}</TableHead>
                  <TableHead>{t("quantity")}</TableHead>
                  <TableHead>{t("qtyType")}</TableHead>
                  <TableHead>{t("uom")}</TableHead>
                  <TableHead>{t("discount")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {truncateDescription(product.description)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-sm">
                          {t("currencySymbol")}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getSalePrice(product)}
                          onChange={(e) =>
                            handleSellPriceChange(
                              product.id,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-24 p-1 h-8 text-sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.quantity ?? 1}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!Number.isNaN(val)) {
                            handleQuantityChange(product.id, val);
                          }
                        }}
                        className="w-16 p-1 border rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={product.quantityType || "prime"}
                        onValueChange={(val) =>
                          handleQuantityTypeChange(
                            product.id,
                            val as "prime" | "damaged",
                          )
                        }
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prime">{t("prime")}</SelectItem>
                          <SelectItem value="damaged">
                            {t("damaged")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatUom(product.unit_of_measurement)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={product.discount || ""}
                          onChange={(e) =>
                            handleDiscountChange(
                              product.id,
                              parseFloat(e.target.value),
                            )
                          }
                          className="w-24 p-1 border rounded"
                        />
                        <Select
                          value={product.discountType || "value"}
                          onValueChange={(val) =>
                            handleDiscountTypeChange(
                              product.id,
                              val as "value" | "percentage",
                            )
                          }
                        >
                          <SelectTrigger className="w-16 h-8 text-xs">
                            <SelectValue placeholder={t("pkr")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="value">PKR</SelectItem>
                            <SelectItem value="percentage">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t("currencySymbol")}{" "}
                      {Math.floor(calculateLineTotal(product))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveProduct(product.id)}
                      >
                        {t("remove")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {selectedProducts.map((product) => (
              <Card key={product.id} className="p-3 border">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground">
                          {truncateDescription(product.description, 50)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.id)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("sellPrice")}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t("currencySymbol")}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={getSalePrice(product)}
                          onChange={(e) =>
                            handleSellPriceChange(
                              product.id,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-20 h-7 p-1 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("qty")} / {t("uom")}
                      </p>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={product.quantity ?? 1}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!Number.isNaN(val)) {
                              handleQuantityChange(product.id, val);
                            }
                          }}
                          className="w-12 h-7 p-1 border rounded text-xs"
                        />
                        <span className="text-xs text-muted-foreground pt-1">
                          {formatUom(product.unit_of_measurement)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("qtyType")}
                    </p>
                    <Select
                      value={product.quantityType || "prime"}
                      onValueChange={(val) =>
                        handleQuantityTypeChange(
                          product.id,
                          val as "prime" | "damaged",
                        )
                      }
                    >
                      <SelectTrigger className="w-full h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prime">{t("prime")}</SelectItem>
                        <SelectItem value="damaged">{t("damaged")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <Input
                        type="number"
                        placeholder="0"
                        value={product.discount || ""}
                        onChange={(e) =>
                          handleDiscountChange(
                            product.id,
                            parseFloat(e.target.value),
                          )
                        }
                        className="h-7 text-xs p-1"
                      />
                    </div>
                    <Select
                      value={product.discountType || "value"}
                      onValueChange={(val) =>
                        handleDiscountTypeChange(
                          product.id,
                          val as "value" | "percentage",
                        )
                      }
                    >
                      <SelectTrigger className="w-16 h-7 text-xs">
                        <SelectValue placeholder={t("pkr")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value">{t("pkr")}</SelectItem>
                        <SelectItem value="percentage">
                          {t("percentage")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground">
                      {t("amount")}
                    </p>
                    <p className="font-bold text-sm">
                      {t("currencySymbol")}{" "}
                      {Math.floor(calculateLineTotal(product))}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Add Item Row - Desktop */}
          <div className="hidden md:block mt-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Combobox
                      items={products.map((p) => ({
                        ...p,
                        description: truncateDescription(p.description, 50),
                      }))}
                      placeholder={t("addItem")}
                      noSelect
                      onSelect={handleSelectProduct}
                    />
                  </TableCell>
                  <TableCell colSpan={6}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Add Item - Mobile */}
          <div className="md:hidden mt-3">
            <Label className="text-xs font-medium">{t("addItem")}</Label>
            <Combobox
              items={products.map((p) => ({
                ...p,
                description: truncateDescription(p.description, 50),
              }))}
              placeholder={t("selectProductToAdd")}
              noSelect
              onSelect={handleSelectProduct}
            />
          </div>

          {/* Summary Section */}
          <div className="mt-4 md:mt-6 space-y-4">
            {/* Summary Grid - Desktop */}
            <div className="hidden md:flex justify-end mb-4">
              <div className="space-y-3 max-w-md w-full">
                <div className="grid grid-cols-[auto_120px] gap-x-4 gap-y-2 items-center">
                  <span className="text-sm text-right">{t("subTotal")}</span>
                  <span className="text-left font-semibold">
                    {t("currencySymbol")} {Math.round(total)}
                  </span>

                  <span className="text-sm text-right">
                    {t("overallDiscount")}
                  </span>
                  <div className="flex gap-1 items-center justify-end">
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      className="w-14 h-8 text-sm"
                      value={overallDiscount || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setOverallDiscount(isNaN(value) ? 0 : Math.abs(value));
                      }}
                    />
                    <Select
                      value={overallDiscountType}
                      onValueChange={(val) =>
                        setOverallDiscountType(val as "value" | "percentage")
                      }
                    >
                      <SelectTrigger className="w-20 h-8 text-xs">
                        <SelectValue placeholder={t("pkr")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value">{t("pkr")}</SelectItem>
                        <SelectItem value="percentage">
                          {t("percentage")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <span className="text-sm text-right">
                    {t("shippingCharges")}
                  </span>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    className="w-full h-8 text-sm"
                    value={shippingCharges || ""}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setShippingCharges(isNaN(value) ? 0 : Math.abs(value));
                    }}
                  />
                </div>

                {/* Add Charge Form */}
                <div className="space-y-2">
                  <div className="flex gap-2 items-center justify-end">
                    <Input
                      id="new-charge-item"
                      placeholder={t("adjustment")}
                      className="w-32 h-8 text-sm"
                      value={newChargeItem}
                      onChange={(e) => setNewChargeItem(e.target.value)}
                    />
                    <span className="text-sm">:</span>
                    <Input
                      id="new-charge-value"
                      type="number"
                      placeholder={t("value")}
                      className="w-24 h-8 text-sm"
                      value={newChargeValue}
                      onChange={(e) => setNewChargeValue(e.target.value)}
                    />
                  </div>

                  {/* Add More Button */}
                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={handleAddNewCharge}
                      variant="default"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={!newChargeItem.trim() || !newChargeValue}
                    >
                      {t("addMore")}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {/* Display Added Charges */}
                    {charges.map((charge) => (
                      <div
                        key={charge.id}
                        className="flex gap-2 items-center justify-end"
                      >
                        <Input
                          placeholder={t("adjustment")}
                          value={charge.item}
                          onChange={(e) =>
                            handleChargeChange(
                              charge.id,
                              "item",
                              e.target.value,
                            )
                          }
                          className="w-32 h-8 text-sm"
                        />
                        <span className="text-sm">:</span>
                        <Input
                          type="number"
                          placeholder={t("value")}
                          value={charge.value || ""}
                          onChange={(e) =>
                            handleChargeChange(
                              charge.id,
                              "value",
                              e.target.value,
                            )
                          }
                          className="w-24 h-8 text-sm"
                        />
                        <Button
                          onClick={() => handleRemoveCharge(charge.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Total */}
                <div className="grid grid-cols-[auto_120px] gap-x-4 items-center border-2 border-primary rounded-md p-3 bg-primary/5">
                  <span className="text-lg text-right font-bold">Total:</span>
                  <span className="text-left text-lg font-bold">
                    Rs. {Math.floor(finalTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Section - Mobile */}
            <div className="md:hidden space-y-3">
              <Card className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      {t("subTotal")}
                    </span>
                    <span className="font-semibold text-sm">
                      {t("currencySymbol")} {Math.round(total)}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t("overallDiscount")}
                    </p>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="0"
                        min="0"
                        className="flex-1 h-7 text-xs"
                        value={overallDiscount || ""}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setOverallDiscount(
                            isNaN(value) ? 0 : Math.abs(value),
                          );
                        }}
                      />
                      <Select
                        value={overallDiscountType}
                        onValueChange={(val) =>
                          setOverallDiscountType(val as "value" | "percentage")
                        }
                      >
                        <SelectTrigger className="w-16 h-7 text-xs">
                          <SelectValue placeholder={t("pkr")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value">{t("pkr")}</SelectItem>
                          <SelectItem value="percentage">
                            {t("percentage")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t("shippingCharges")}
                    </p>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      className="w-full h-7 text-xs"
                      value={shippingCharges || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setShippingCharges(isNaN(value) ? 0 : Math.abs(value));
                      }}
                    />
                  </div>
                </div>
              </Card>

              {/* Add Charge Form - Mobile */}
              <Card className="p-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium">
                    {t("additionalCharges")}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="new-charge-item"
                      placeholder={t("adjustment")}
                      className="flex-1 h-7 text-xs"
                      value={newChargeItem}
                      onChange={(e) => setNewChargeItem(e.target.value)}
                    />
                    <Input
                      id="new-charge-value"
                      type="number"
                      placeholder={t("value")}
                      className="w-20 h-7 text-xs"
                      value={newChargeValue}
                      onChange={(e) => setNewChargeValue(e.target.value)}
                    />
                    <Button
                      onClick={handleAddNewCharge}
                      variant="default"
                      size="sm"
                      className="h-7 text-xs px-2"
                      disabled={!newChargeItem.trim() || !newChargeValue}
                    >
                      {t("add")}
                    </Button>
                  </div>

                  {/* Display Added Charges */}
                  {charges.length > 0 && (
                    <div className="space-y-2 border-t pt-2">
                      {charges.map((charge) => (
                        <div
                          key={charge.id}
                          className="flex gap-2 items-center"
                        >
                          <Input
                            placeholder={t("adjustment")}
                            value={charge.item}
                            onChange={(e) =>
                              handleChargeChange(
                                charge.id,
                                "item",
                                e.target.value,
                              )
                            }
                            className="flex-1 h-7 text-xs"
                          />
                          <Input
                            type="number"
                            placeholder={t("value")}
                            value={charge.value || ""}
                            onChange={(e) =>
                              handleChargeChange(
                                charge.id,
                                "value",
                                e.target.value,
                              )
                            }
                            className="w-20 h-7 text-xs"
                          />
                          <Button
                            onClick={() => handleRemoveCharge(charge.id)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Final Total - Mobile */}
              <Card className="p-4 border-2 border-primary bg-primary/5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-base">{t("total")}:</span>
                  <span className="font-bold text-lg">
                    {t("currencySymbol")} {Math.floor(finalTotal)}
                  </span>
                </div>
              </Card>
            </div>

            {/* Customer Notes */}
            <div className="mt-4 md:mt-6">
              <div className="flex flex-col gap-1 w-full md:max-w-md">
                <Label className="text-sm font-medium">
                  {t("customerNotes")}
                </Label>
                <textarea
                  className="w-full min-h-[80px] rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {t("willBeDisplayedOnInvoice")}
                </span>
              </div>
            </div>

            <div className="flex justify-end mt-4 md:mt-6">
              <Button
                onClick={handleSaveOrder}
                disabled={
                  selectedProducts.length === 0 ||
                  !selectedCustomer ||
                  !invoiceNo
                }
                className="w-full md:w-auto"
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overstock Warning Dialog - shown before invoice preview when stock exceeded */}
      <ConfirmDialog
        open={showOverstockDialog}
        onOpenChange={setShowOverstockDialog}
        title={t("overstockWarningTitle")}
        description={
          <div className="space-y-3">
            <ul className="list-disc list-inside space-y-1 text-foreground">
              {overstockItems.map((item, idx) => (
                <li key={idx}>
                  {item.name}: {item.requested} {t("quantityRequested")},{" "}
                  {item.inStock} {t("inStock")}
                </li>
              ))}
            </ul>
            <p className="pt-1">{t("overstockWarningProceed")}</p>
          </div>
        }
        confirmLabel={t("overstockProceed")}
        cancelLabel={t("cancel")}
        onConfirm={handleOverstockConfirm}
        onCancel={handleOverstockCancel}
        variant="warning"
      />

      {/* Invoice Preview Dialog */}
      <InvoicePreviewDialog
        open={showInvoicePreview}
        onOpenChange={setShowInvoicePreview}
        invoiceNo={invoiceNo}
        customer={{
          name: selectedCustomer?.name || "",
          email: selectedCustomer?.email,
          phone: selectedCustomer?.phone,
        }}
        saleDate={selectedDate}
        dueDate={addDueDate ? dueDate : null}
        products={selectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          quantity: p.quantity,
          quantityType: p.quantityType,
          sell_price: p.sell_price,
          unit_of_measurement: p.unit_of_measurement,
          discount: p.discount,
          discountType: p.discountType,
        }))}
        subtotal={total}
        charges={displayCharges.map((charge) => ({
          item: charge.item,
          value: charge.value,
        }))}
        overallDiscount={overallDiscountAmount}
        shippingCharges={shippingChargesNum}
        total={finalTotal}
        companyName={session?.user?.company || session?.user?.name || ""}
        customerNotes={customerNotes}
        onCreateOrder={handleCreateOrder}
      />
    </div>
  );
}
