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
import { calculateLineTotal } from "@/lib/invoice-calculations";

type Product = {
  id: number;
  name: string;
  description?: string;
  sell_price: number;
  unit_of_measurement?: string;
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
  const [customerNotes, setCustomerNotes] = useState<string>(
    "Thanks for your business",
  );

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
      if (!response.ok) throw new Error("Failed to fetch customers");
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch("/api/payment-methods");
      if (!response.ok) throw new Error("Failed to fetch payment methods");
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

  const handleQuantityChange = (productId: number, newQuantity: number) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, quantity: newQuantity } : p,
      ),
    );
  };

  const handleDiscountChange = (productId: number, newDiscount: number) => {
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
    productId: number,
    newType: "value" | "percentage",
  ) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId ? { ...p, discountType: newType } : p,
      ),
    );
  };

  const handleRemoveProduct = (productId: number) => {
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
          item: newChargeItem.trim() || "Adjustment",
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

  const handleSaveOrder = async () => {
    if (!selectedCustomer || selectedProducts.length === 0 || !invoiceNo) {
      return;
    }
    // Show the invoice preview dialog instead of directly saving
    setShowInvoicePreview(true);
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
          <div className="grid grid-cols-12 gap-2 items-end">
            {/* Invoice No & Generate Button */}
            <div className="col-span-2">
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
            <div className="col-span-3">
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
            <div className="col-span-2">
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
            <div className="col-span-2 flex items-center gap-2">
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
                {t("addDueDate")}
              </Label>
            </div>

            {/* Due Date Input - Conditional */}
            {addDueDate && (
              <div className="col-span-2">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("item")}</TableHead>
                <TableHead>{t("sellPrice")}</TableHead>
                <TableHead>{t("quantity")}</TableHead>
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
                  <TableCell>Rs. {Math.floor(getSalePrice(product))}</TableCell>
                  <TableCell>
                    <input
                      type="number"
                      min="1"
                      value={product.quantity || 1}
                      onChange={(e) =>
                        handleQuantityChange(
                          product.id,
                          parseInt(e.target.value),
                        )
                      }
                      className="w-16 p-1 border rounded"
                    />
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
                          <SelectItem value="value">{t("pkr")}</SelectItem>
                          <SelectItem value="percentage">
                            {t("percentage")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell>
                    Rs. {Math.floor(calculateLineTotal(product))}
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
              <TableRow>
                <TableCell>
                  <Combobox
                    items={products}
                    placeholder={t("addItem")}
                    noSelect
                    onSelect={handleSelectProduct}
                  />
                </TableCell>
                <TableCell colSpan={6}></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Summary Section */}
          <div className="mt-4">
            {/* All Summary Fields in One Grid */}
            <div className="flex justify-end mb-4">
              <div className="space-y-3">
                <div className="grid grid-cols-[auto_120px] gap-x-4 gap-y-2 items-center">
                  <span className="text-sm text-right">{t("subTotal")}</span>
                  <span className="text-left font-semibold">
                    Rs. {Math.round(total)}
                  </span>

                  <span className="text-sm text-right">
                    {t("overallDiscount")}
                  </span>
                  <div className="flex gap-1 items-center">
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      className="w-16 h-8 text-sm"
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
                      <SelectTrigger className="w-16 h-8 text-xs">
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
                  <div className="flex gap-2 items-center">
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
                  {/* {(newChargeItem.trim() || newChargeValue) && ( */}
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
                  {/* )} */}

                  <div className="space-y-2">
                    {/* Display Added Charges */}
                    {charges.map((charge) => (
                      <div key={charge.id} className="flex gap-2 items-center">
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
                  <span className="text-lg text-right font-bold">
                    {t("total")}
                  </span>
                  <span className="text-left text-lg font-bold">
                    Rs. {Math.floor(finalTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Notes */}
            <div className="mt-4 flex justify-start">
              <div className="flex flex-col gap-1 w-full max-w-md">
                <Label className="text-sm font-medium">
                  {t("customerNotes")}
                </Label>
                <textarea
                  className="w-full min-h-[80px] rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">
                  {t("willBeDisplayed")}
                </span>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSaveOrder}
                disabled={
                  selectedProducts.length === 0 ||
                  !selectedCustomer ||
                  !invoiceNo
                }
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
