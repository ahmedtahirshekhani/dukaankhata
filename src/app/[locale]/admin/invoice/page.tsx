"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDebounce } from "../../../../hooks/use-debounce";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import {
  Loader2Icon,
  PlusCircle,
  Trash2,
  SearchIcon,
  FilterIcon,
  FilePenIcon,
  EyeIcon,
  XIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { InvoicePreviewDialog } from "@/components/invoice/invoice-preview-dialog";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { calculateLineTotal } from "@/lib/invoice/calculations";
import { Pagination } from "@/components/ui/pagination";
import { Plus } from "lucide-react";

// ------------------------------------------------------------
// Edit Order Dialog Component (embedded for clarity)
// ------------------------------------------------------------
type OrderProduct = {
  id: number | string;
  name: string;
  description?: string;
  quantity: number;
  quantityType: "prime" | "damaged";
  sell_price: number;
  discount: number;
  discountType: "value" | "percentage";
  unit_of_measurement?: string;
};

type OrderCharge = {
  id: string;
  item: string;
  value: number;
};

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onOrderUpdated: () => void;
}

function EditOrderDialog({ open, onOpenChange, order, onOrderUpdated }: EditOrderDialogProps) {
  const t = useTranslations("orders");
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [saleDate, setSaleDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [charges, setCharges] = useState<OrderCharge[]>([]);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [overallDiscountType, setOverallDiscountType] = useState<"value" | "percentage">("value");
  const [shippingCharges, setShippingCharges] = useState(0);
  const [customerNotes, setCustomerNotes] = useState("");
  const [payment, setPayment] = useState({
    method: "",
    paidAmount: 0,
    paidDate: "",
    noPaymentAtAll: false,
  });
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (order && open) {
      setCustomerId(order.customer_id?.toString() || "");
      setSaleDate(order.sale_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
      setDueDate(order.due_date?.split("T")[0] || "");
      setInvoiceNo(order.invoice_no || "");
      setProducts((order.items || []).map((item: any) => ({
        id: item.product_id || item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        quantityType: item.quantityType || "prime",
        sell_price: item.price,
        discount: item.discount || 0,
        discountType: item.discountType || "value",
        unit_of_measurement: item.unit_of_measurement,
      })));
      setCharges((order.charges || []).map((c: any, idx: number) => ({ id: idx.toString(), item: c.item, value: c.value })));
      setOverallDiscount(order.overallDiscount || 0);
      setOverallDiscountType(order.overallDiscountType || "value");
      setShippingCharges(order.shippingCharges || 0);
      setCustomerNotes(order.customer_notes || "");
      setPayment({
        method: order.payment?.method || "",
        paidAmount: order.payment?.paid_amount || 0,
        paidDate: order.payment?.paid_date?.split("T")[0] || "",
        noPaymentAtAll: order.payment?.no_payment_at_all || false,
      });
    }
  }, [order, open]);

  const subtotal = products.reduce((sum, p) => sum + calculateLineTotal(p), 0);
  const discountAmount = overallDiscountType === "percentage" ? (subtotal * overallDiscount) / 100 : overallDiscount;
  const chargesTotal = charges.reduce((s, c) => s + c.value, 0);
  const total = Math.max(0, subtotal - discountAmount + shippingCharges + chargesTotal);

  const handleAddProduct = (productId: string, product: any) => {
    if (products.some(p => p.id === productId)) {
      setProducts(products.map(p => p.id === productId ? { ...p, quantity: p.quantity + 1 } : p));
    } else {
      setProducts([...products, {
        id: productId,
        name: product.name,
        description: product.description,
        quantity: 1,
        quantityType: "prime",
        sell_price: product.sell_price,
        discount: 0,
        discountType: "value",
        unit_of_measurement: product.unit_of_measurement,
      }]);
    }
  };

  const handleUpdateProduct = (idx: number, field: string, value: any) => {
    const updated = [...products];
    updated[idx] = { ...updated[idx], [field]: value };
    setProducts(updated);
  };

  const handleRemoveProduct = (idx: number) => {
    setProducts(products.filter((_, i) => i !== idx));
  };

  const handleAddCharge = () => {
    setCharges([...charges, { id: Date.now().toString(), item: "", value: 0 }]);
  };

  const handleUpdateCharge = (idx: number, field: "item" | "value", val: string | number) => {
    const updated = [...charges];
    updated[idx] = { ...updated[idx], [field]: val };
    setCharges(updated);
  };

  const handleRemoveCharge = (idx: number) => {
    setCharges(charges.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!customerId || products.length === 0) {
      setErrorMessage(t("selectPartyAndItems"));
      setShowErrorDialog(true);
      return;
    }

    if (payment.paidAmount > total) {
      setErrorMessage(t("paidAmountExceedsTotal"));
      setShowErrorDialog(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          saleDate,
          dueDate: dueDate || null,
          invoiceNo,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            quantity: p.quantity,
            quantityType: p.quantityType,
            price: p.sell_price,
            discount: p.discount,
            discountType: p.discountType,
            unit_of_measurement: p.unit_of_measurement,
          })),
          subtotal,
          charges: charges.map(c => ({ item: c.item, value: c.value })),
          overallDiscount,
          shippingCharges,
          total,
          payment: {
            method: payment.method,
            paidAmount: payment.paidAmount,
            paidDate: payment.paidDate || null,
            noPaymentAtAll: payment.noPaymentAtAll,
          },
          customerNotes,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      onOrderUpdated();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setErrorMessage(t("updateError"));
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editOrder")} - {order?.invoice_no || `ORD-${order?.id}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>{t("customer")}</Label>
              <PartyDropdown value={customerId} onValueChange={setCustomerId} placeholder={t("selectCustomer")} />
            </div>
            <div>
              <Label>{t("saleDate")}</Label>
              <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("dueDate")}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("invoiceNo")}</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
          </div>

          {/* Products Table */}
          <div>
            <Label className="mb-2 block">{t("products")}</Label>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead>{t("price")}</TableHead>
                    <TableHead>{t("quantity")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("discount")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="min-w-[150px]">
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={p.sell_price} onChange={(e) => handleUpdateProduct(idx, "sell_price", parseFloat(e.target.value) || 0)} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={p.quantity} onChange={(e) => handleUpdateProduct(idx, "quantity", parseFloat(e.target.value) || 0)} className="w-20" />
                      </TableCell>
                      <TableCell>
                        <Select value={p.quantityType} onValueChange={(val) => handleUpdateProduct(idx, "quantityType", val)}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="prime">{t("prime")}</SelectItem>
                            <SelectItem value="damaged">{t("damaged")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <Input type="number" value={p.discount} onChange={(e) => handleUpdateProduct(idx, "discount", parseFloat(e.target.value) || 0)} className="w-20" />
                        <Select value={p.discountType} onValueChange={(val) => handleUpdateProduct(idx, "discountType", val)}>
                          <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="value">PKR</SelectItem>
                            <SelectItem value="percentage">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{Math.floor(calculateLineTotal(p))}</TableCell>
                      <TableCell>
                        <Button 
                          variant="danger" 
                          size="icon" 
                          onClick={() => handleRemoveProduct(idx)}
                          disabled={products.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={7}>
                      <ProductDropdown value="" onValueChange={(val, prod) => prod && handleAddProduct(val, prod)} placeholder={t("addProduct")} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Charges */}
          <div>
            <Label className="mb-2 block">{t("charges")}</Label>
            {charges.map((ch, idx) => (
              <div key={ch.id} className="flex gap-2 mb-2">
                <Input placeholder={t("chargeName")} value={ch.item} onChange={(e) => handleUpdateCharge(idx, "item", e.target.value)} />
                <Input type="number" placeholder={t("amount")} value={ch.value} onChange={(e) => handleUpdateCharge(idx, "value", parseFloat(e.target.value) || 0)} />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveCharge(idx)}><XIcon className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddCharge}><Plus className="w-4 h-4 mr-1" />{t("addCharge")}</Button>
          </div>

          {/* Discount & Shipping */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("overallDiscount")}</Label>
              <div className="flex gap-2">
                <Input type="number" value={overallDiscount} onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)} />
                <Select value={overallDiscountType} onValueChange={(val: any) => setOverallDiscountType(val)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">PKR</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("shippingCharges")}</Label>
              <Input type="number" value={shippingCharges} onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Payment */}
          <div>
            <Label className="mb-2 block">{t("payment")}</Label>
            <div className="grid grid-cols-2 gap-4">
              {!payment.noPaymentAtAll && (
                <>
                  <div>
                    <Label>{t("paymentMethod")}</Label>
                    <PaymentMethodDropdown
                      value={payment.method}
                      onValueChange={(val) => setPayment({ ...payment, method: val })}
                      placeholder={t("selectMethod") || "Select Method"}
                      enableSearch={true}
                      searchPlaceholder="Search payment method..."
                      noResultsText="No payment methods found"
                      addButtonPosition="bottom"
                      includeDefaultMethods={true}
                    />
                  </div>
                  <div>
                    <Label>{t("paidAmount")}</Label>
                    <Input
                      type="number"
                      value={payment.paidAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (val > total) {
                          setErrorMessage(t("paidAmountExceedsTotal"));
                          setShowErrorDialog(true);
                        }
                        setPayment({ ...payment, paidAmount: val });
                      }}
                    />
                  </div>
                  <div>
                    <Label>{t("paidDate")}</Label>
                    <Input type="date" value={payment.paidDate} onChange={(e) => setPayment({ ...payment, paidDate: e.target.value })} />
                  </div>
                </>
              )}
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="noPayment" checked={payment.noPaymentAtAll} onChange={(e) => setPayment({ ...payment, noPaymentAtAll: e.target.checked })} />
                <Label htmlFor="noPayment">{t("noPaymentAtAll")}</Label>
              </div>
            </div>
          </div>

          {/* Customer Notes */}
          <div>
            <Label>{t("customerNotes")}</Label>
            <textarea className="w-full border rounded-md p-2" rows={3} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
          </div>

          {/* Total */}
          <div className="text-right text-xl font-bold">
            {t("total")}: {Math.floor(total)} PKR
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? t("updating") : t("updateOrder")}</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <ErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        title={t("error")}
        message={errorMessage}
      />
    </>
  );
}

// ------------------------------------------------------------
// Main Orders Page Component
// ------------------------------------------------------------
type Order = {
  id: number;
  customer_id: number;
  total_amount: number;
  subtotal?: number;
  status: "completed" | "pending" | "cancelled";
  created_at: string;
  invoice_no?: string;
  sale_date?: string;
  due_date?: string | null;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    name: string;
    description?: string;
    quantity: number;
    price: number;
    discount?: number;
    unit_of_measurement?: string;
    discountType?: "value" | "percentage";
  }>;
  charges?: Array<{
    item: string;
    value: number;
  }>;
  overallDiscount?: number;
  shippingCharges?: number;
  payment?: {
    method: string;
    paid_amount: number;
    paid_date: string;
    no_payment_at_all: boolean;
  } | null;
};

export default function OrdersPage() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "all" });
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL("/api/orders", window.location.origin);
      url.searchParams.append("page", currentPage.toString());
      url.searchParams.append("limit", pageSize.toString());
      if (debouncedSearchTerm) {
        url.searchParams.append("search", debouncedSearchTerm);
      }
      if (filters.status !== "all") {
        url.searchParams.append("status", filters.status);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(t("failedToFetchOrders"));
      const data = await response.json();
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t, currentPage, pageSize, debouncedSearchTerm, filters.status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // filteredOrders is still useful for local filtering if needed, but we should probably rely on backend search
  const filteredOrders = orders; 

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: string) => {
    setFilters({ status: value });
    setCurrentPage(1);
  };

  const handleEditOrder = (order: Order) => {
    setOrderToEdit(order);
    setEditOrderOpen(true);
  };

  const handleOrderUpdated = () => {
    fetchOrders();
  };

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/orders?id=${orderToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(t("errorDeletingOrder"));
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
      fetchOrders();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
        <Card>
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageDescription")}</p>
      </div>
      <Card className="flex flex-col gap-6 p-6">
        <CardHeader className="p-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pr-8"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FilterIcon className="w-4 h-4" />
                    <span>{t("filters")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("filterByStatus")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.status === "all"}
                    onCheckedChange={() => handleFilterChange("all")}
                  >
                    {t("allStatuses")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.status === "completed"}
                    onCheckedChange={() => handleFilterChange("completed")}
                  >
                    {t("completed")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.status === "pending"}
                    onCheckedChange={() => handleFilterChange("pending")}
                  >
                    {t("pending")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.status === "cancelled"}
                    onCheckedChange={() => handleFilterChange("cancelled")}
                  >
                    {t("cancelled")}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button asChild className="gap-2 self-start">
              <Link href={`/${locale}/admin/invoice/new`}>
                <PlusCircle className="w-4 h-4" />
                {t("createOrder")}
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 relative">
          {loading && orders.length > 0 && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[2px]">
              <Loader2Icon className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoiceNo")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("total")}</TableHead>
                  <TableHead>{t("paid")}</TableHead>
                  <TableHead>{t("balance")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("noOrdersFound") || "No orders found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.invoice_no || `ORD-${order.id}`}</TableCell>
                      <TableCell>{order.customer?.name || "-"}</TableCell>
                      <TableCell>{t("currencySymbol")} {Math.floor(order.total_amount)}</TableCell>
                      <TableCell>{t("currencySymbol")} {Math.floor(order.payment?.paid_amount || 0)}</TableCell>
                      <TableCell>
                        {t("currencySymbol")}{" "}
                        {Math.floor(order.total_amount - (order.payment?.paid_amount || 0))}
                      </TableCell>
                      <TableCell>
                        {new Date(order.sale_date || order.created_at).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEditOrder(order)} className="h-8 w-8">
                            <FilePenIcon className="w-4 h-4" />
                            <span className="sr-only">{t("edit")}</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedInvoiceOrder(order);
                              setInvoiceDialogOpen(true);
                            }}
                          >
                            <EyeIcon className="w-4 h-4" />
                            <span className="sr-only">{t("showInvoice")}</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="danger"
                            className="h-8 w-8"
                            onClick={() => handleDeleteClick(order)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">{t("delete")}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("noOrdersFound") || "No orders found"}
              </div>
            ) : (
              filteredOrders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("invoiceNo")}</p>
                        <p className="font-semibold text-sm">{order.invoice_no || `ORD-${order.id}`}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEditOrder(order)} className="h-8 w-8">
                          <FilePenIcon className="w-4 h-4" />
                        </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedInvoiceOrder(order);
                              setInvoiceDialogOpen(true);
                            }}
                            className="h-8 w-8"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="danger"
                            className="h-8 w-8"
                            onClick={() => handleDeleteClick(order)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("customer")}</p>
                      <p className="font-medium text-sm">{order.customer?.name || "-"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("total")}</p>
                        <p className="font-semibold text-sm">
                          {t("currencySymbol")} {Math.floor(order.total_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("paid")}</p>
                        <p className="font-semibold text-sm">
                          {t("currencySymbol")} {Math.floor(order.payment?.paid_amount || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("balance")}</p>
                        <p className="font-semibold text-sm">
                          {t("currencySymbol")}{" "}
                          {Math.floor(order.total_amount - (order.payment?.paid_amount || 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t("date")}</p>
                        <p className="font-semibold text-sm">
                          {new Date(order.sale_date || order.created_at).toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {totalCount} {t("total")}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Rows per page
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={loading}
          />
        </CardFooter>
      </Card>

      {/* Invoice Preview Dialog */}
      {selectedInvoiceOrder && (
        <InvoicePreviewDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          invoiceNo={selectedInvoiceOrder.invoice_no || `ORD-${selectedInvoiceOrder.id}`}
          customer={selectedInvoiceOrder.customer}
          saleDate={selectedInvoiceOrder.sale_date || selectedInvoiceOrder.created_at}
          dueDate={selectedInvoiceOrder.due_date || null}
          products={(selectedInvoiceOrder.items || []).map((item, index) => ({
            id: index,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            sell_price: item.price,
            unit_of_measurement: item.unit_of_measurement,
            discount: item.discount,
            discountType: item.discountType,
          }))}
          subtotal={selectedInvoiceOrder.subtotal || selectedInvoiceOrder.total_amount}
          charges={selectedInvoiceOrder.charges || []}
          overallDiscount={selectedInvoiceOrder.overallDiscount || 0}
          shippingCharges={selectedInvoiceOrder.shippingCharges || 0}
          total={selectedInvoiceOrder.total_amount}
          onMakePayment={() => {}}
          onCreateOrder={() => {}}
          hidePaymentActions={true}
          initialPayment={selectedInvoiceOrder.payment}
        />
      )}

      {/* Edit Order Dialog */}
      {orderToEdit && (
        <EditOrderDialog
          open={editOrderOpen}
          onOpenChange={setEditOrderOpen}
          order={orderToEdit}
          onOrderUpdated={handleOrderUpdated}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t("confirmDeletion")}
        description={t("confirmDeleteMessage", { invoiceNo: orderToDelete?.invoice_no || `ORD-${orderToDelete?.id}` })}
        onConfirm={handleDeleteConfirm}
        isLoading={deleting}
        variant="danger"
      />
    </div>
  );
}