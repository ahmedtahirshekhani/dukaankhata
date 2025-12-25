"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";

type Product = {
  id: number;
  name: string;
  price: number;
};

type Customer = {
  id: number;
  name: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

interface POSProduct extends Product {
  quantity: number;
}

export default function POSPage() {
  const t = useTranslations("pos");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [addDueDate, setAddDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [charges, setCharges] = useState<Array<{ id: string; item: string; value: number }>>([]);
  const [showAddCharge, setShowAddCharge] = useState<boolean>(false);
  const [newChargeItem, setNewChargeItem] = useState<string>("");
  const [newChargeValue, setNewChargeValue] = useState<string>("");
  const [showInvoicePreview, setShowInvoicePreview] = useState<boolean>(false);

  useEffect(() => {
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
          p.id === productId ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      setSelectedProducts([...selectedProducts, { ...product, quantity: 1 }]);
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
        p.id === productId ? { ...p, quantity: newQuantity } : p
      )
    );
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
  };

  const total = selectedProducts.reduce(
    (sum, product) => sum + product.price * (product.quantity || 1),
    0
  );

  const handleChargeChange = (id: string, field: "item" | "value", val: string | number) => {
    setCharges(
      charges.map((charge) =>
        charge.id === id
          ? { ...charge, [field]: field === "value" ? parseFloat(val.toString()) || 0 : val }
          : charge
      )
    );
  };

  const handleRemoveCharge = (id: string) => {
    setCharges(charges.filter((charge) => charge.id !== id));
  };

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

  const chargesTotal = charges.reduce((sum, charge) => sum + charge.value, 0);
  const finalTotal = total + chargesTotal;

  const handleSaveOrder = async () => {
    if (!selectedCustomer || selectedProducts.length === 0 || !invoiceNo) {
      return;
    }
    // Show the invoice preview dialog instead of directly saving
    setShowInvoicePreview(true);
  };

  const handleMakePayment = () => {
    console.log("Make payment clicked");
    // Add payment logic here
    setShowInvoicePreview(false);
  };

  const handleCreateOrder = async () => {
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
          products: selectedProducts.map(p => ({ id: p.id, quantity: p.quantity, price: p.price })),
          subtotal: total,
          charges: charges.map(c => ({ item: c.item, value: c.value })),
          total: finalTotal,
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
          <p className="text-sm text-muted-foreground">{t("pageDescription")}</p>
        </div>
      </div>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Sale Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 items-end">
            {/* Invoice No & Generate Button */}
            <div className="col-span-2">
              <Label htmlFor="invoice-no" className="text-xs font-medium">Invoice No.</Label>
              <Input
                id="invoice-no"
                placeholder="Enter/Generate"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button onClick={generateInvoiceNo} variant="outline" size="sm" className="h-8 col-span-1">
              Generate
            </Button>

            {/* Customer Selection */}
            <div className="col-span-3">
              <Label htmlFor="customer" className="text-xs font-medium">Customer</Label>
              <Combobox
                items={customers}
                placeholder="Select Customer"
                onSelect={handleSelectCustomer}
              />
            </div>

            {/* Sale Date */}
            <div className="col-span-2">
              <Label htmlFor="sale-date" className="text-xs font-medium">Sale Date</Label>
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
              <Label htmlFor="add-due-date" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                Add Due Date
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
          <CardTitle>Products</CardTitle>
          <Combobox
            items={products}
            placeholder="Select Product"
            noSelect
            onSelect={handleSelectProduct}
            className="!mt-5"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    Rs. {Math.floor(product.price)}
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      min="1"
                      value={product.quantity || 1}
                      onChange={(e) =>
                        handleQuantityChange(
                          product.id,
                          parseInt(e.target.value)
                        )
                      }
                      className="w-16 p-1 border rounded"
                    />
                  </TableCell>
                  <TableCell>
                    Rs. {Math.floor((product.quantity || 1) * product.price)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Summary Section - Bottom Right */}
          <div className="mt-4">
            <div className="text-right mb-2">
              <strong>Sub Total: Rs. {Math.floor(total)}</strong>
            </div>

            {/* Additional/Discount Charges Button */}
            <div className="text-right mb-2">
              <Button
                onClick={() => setShowAddCharge(!showAddCharge)}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                + Any additional/discount charges
              </Button>
            </div>

            {/* Add Charge Form */}
            {showAddCharge && (
              <div className="flex justify-end mb-2">
                <div className="p-2 bg-gray-50 rounded-md border">
                  <div className="flex gap-2">
                    <Input
                      id="new-charge-item"
                      placeholder="Item name"
                      className="w-32 h-8 text-sm"
                      value={newChargeItem}
                      onChange={(e) => setNewChargeItem(e.target.value)}
                    />
                    <Input
                      id="new-charge-value"
                      type="number"
                      placeholder="Value"
                      className="w-24 h-8 text-sm"
                      value={newChargeValue}
                      onChange={(e) => setNewChargeValue(e.target.value)}
                    />
                    <Button
                      onClick={handleAddNewCharge}
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Display Added Charges */}
            {charges.length > 0 && (
              <div className="flex justify-end mb-2">
                <div className="text-right space-y-2">
                  {charges.map((charge) => (
                    <div key={charge.id} className="flex gap-2 items-center">
                      <Input
                        placeholder="Item name"
                        value={charge.item}
                        onChange={(e) => handleChargeChange(charge.id, "item", e.target.value)}
                        className="w-32 h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Value"
                        value={charge.value || ""}
                        onChange={(e) => handleChargeChange(charge.id, "value", e.target.value)}
                        className="w-24 h-8 text-xs"
                      />
                      <Button
                        onClick={() => handleRemoveCharge(charge.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final Totals */}
            {chargesTotal !== 0 && (
              <div className="text-right mb-2">
                <strong>Additional Charges: Rs. {Math.floor(chargesTotal)}</strong>
              </div>
            )}
            <div className="text-right border-t pt-2 mb-2">
              <strong className="text-lg">Total: Rs. {Math.floor(finalTotal)}</strong>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSaveOrder}
                disabled={selectedProducts.length === 0 || !selectedCustomer || !invoiceNo}
              >
                Save
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
        customerName={selectedCustomer?.name || ""}
        saleDate={selectedDate}
        dueDate={addDueDate ? dueDate : null}
        products={selectedProducts}
        subtotal={total}
        charges={charges}
        total={finalTotal}
        onMakePayment={handleMakePayment}
        onCreateOrder={handleCreateOrder}
      />
    </div>
  );
}
