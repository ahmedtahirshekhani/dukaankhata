"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
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
    discountInput?: string;
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState("");
  const [newOrderTotal, setNewOrderTotal] = useState("");
  const [newOrderStatus, setNewOrderStatus] = useState<
    "completed" | "pending" | "cancelled"
  >("pending");
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
  });
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] =
    useState<Order | null>(null);
  // console.log("Selected Invoice Order:", selectedInvoiceOrder);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders");
        console.log("Fetch Orders Response:", response);
        if (!response.ok) {
          throw new Error(t("failedToFetchOrders"));
        }
        const data = await response.json();
        setOrders(data);
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      console.log("orders", order);
      if (!order.customer) {
        return false;
      }
      if (filters.status !== "all" && order.status !== filters.status) {
        return false;
      }
      return (
        order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toString().includes(searchTerm)
      );
    });
  }, [orders, filters.status, searchTerm]);

  const resetSelectedOrder = () => {
    setSelectedOrderId(null);
    setNewOrderCustomerName("");
    setNewOrderTotal("");
    setNewOrderStatus("pending");
  };

  const handleAddOrder = useCallback(async () => {
    try {
      const newOrder = {
        total_amount: parseFloat(newOrderTotal),
        status: newOrderStatus,
        created_at: new Date().toISOString().split("T")[0], // Current created_at in YYYY-MM-DD format
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newOrder),
      });

      if (!response.ok) {
        throw new Error(t("errorCreatingOrder"));
      }

      const createdOrder = await response.json();
      setOrders([...orders, createdOrder]);
      setShowNewOrderDialog(false);
      resetSelectedOrder();
    } catch (error) {
      console.error(error);
    }
  }, [newOrderTotal, newOrderStatus, orders, t]);

  const handleEditOrder = useCallback(async () => {
    if (!selectedOrderId) return;
    try {
      const updatedOrder = {
        id: selectedOrderId,
        total_amount: parseFloat(newOrderTotal),
        status: newOrderStatus,
        created_at: orders.find((o) => o.id === selectedOrderId)?.created_at, // Preserve the original created_at
      };
      const response = await fetch(`/api/orders/${selectedOrderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedOrder),
      });

      if (!response.ok) {
        throw new Error(t("errorUpdatingOrder"));
      }

      const updatedOrderData = await response.json();
      setOrders(
        orders.map((o) =>
          o.id === updatedOrderData.id ? updatedOrderData : o,
        ),
      );
      setIsEditOrderDialogOpen(false);
      resetSelectedOrder();
    } catch (error) {
      console.error(error);
    }
  }, [selectedOrderId, newOrderTotal, newOrderStatus, orders, t]);

  const handleDeleteOrder = useCallback(async () => {
    if (!orderToDelete) return;
    try {
      const response = await fetch(`/api/orders/${orderToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error deleting order");
      }

      setOrders(orders.filter((o) => o.id !== orderToDelete.id));
      setIsDeleteConfirmationOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error(error);
    }
  }, [orderToDelete, orders, t]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (value: string) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      status: value,
    }));
  };

  if (loading) {
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
          <div className="flex items-start justify-between gap-4">
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
        <CardContent className="p-0">
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
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      {order.invoice_no || `ORD-${order.id}`}
                    </TableCell>
                    <TableCell>{order.customer.name}</TableCell>
                    <TableCell>{t("currencySymbol")} {Math.floor(order.total_amount)}</TableCell>
                    <TableCell>
                      {t("currencySymbol")} {Math.floor(order.payment?.paid_amount || 0)}
                    </TableCell>
                    <TableCell>
                      {t("currencySymbol")}{" "}
                      {Math.floor(
                        order.total_amount - (order.payment?.paid_amount || 0),
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(
                        order.sale_date || order.created_at,
                      ).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setOrderToDelete(order);
                            setIsDeleteConfirmationOpen(true);
                          }}
                          style={{ display: "none" }}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">{t("delete")}</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedInvoiceOrder(order);
                            setInvoiceDialogOpen(true);
                          }}
                        >
                          <EyeIcon className="w-4 h-4" />
                          <span className="sr-only">{t("showInvoice")}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t("invoiceNo")}
                      </p>
                      <p className="font-semibold text-sm">
                        {order.invoice_no || `ORD-${order.id}`}
                      </p>
                    </div>
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
                      <span className="sr-only">{t("showInvoice")}</span>
                    </Button>
                  </div>

                  <div className="w-full">
                    <p className="text-xs text-muted-foreground">{t("customer")}</p>
                    <p className="font-medium text-sm">{order.customer.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full">
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

                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("balance")}</p>
                      <p className="font-semibold text-sm">
                        {t("currencySymbol")}{" "}
                        {Math.floor(
                          order.total_amount -
                            (order.payment?.paid_amount || 0),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("date")}</p>
                      <p className="font-semibold text-sm">
                        {new Date(
                          order.sale_date || order.created_at,
                        ).toLocaleDateString("en-US", {
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
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          {/* Pagination can be added here if needed */}
        </CardFooter>

        <Dialog
          open={showNewOrderDialog || isEditOrderDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setShowNewOrderDialog(false);
              setIsEditOrderDialogOpen(false);
              resetSelectedOrder();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {showNewOrderDialog ? t("createNewOrder") : t("editOrder")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customerName">{t("customerName")}</Label>
                <Input
                  id="customerName"
                  value={newOrderCustomerName}
                  onChange={(e) => setNewOrderCustomerName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="total">{t("total")}</Label>
                <Input
                  id="total"
                  type="number"
                  value={newOrderTotal}
                  onChange={(e) => setNewOrderTotal(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status">{t("status")}</Label>
                <Select
                  value={newOrderStatus}
                  onValueChange={(
                    value: "completed" | "pending" | "cancelled",
                  ) => setNewOrderStatus(value)}
                >
                  <SelectTrigger id="status" className="col-span-3">
                    <SelectValue placeholder={t("selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">{t("completed")}</SelectItem>
                    <SelectItem value="pending">{t("pending")}</SelectItem>
                    <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewOrderDialog(false);
                  setIsEditOrderDialogOpen(false);
                  resetSelectedOrder();
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={showNewOrderDialog ? handleAddOrder : handleEditOrder}
              >
                {showNewOrderDialog ? t("createOrder") : t("updateOrder")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isDeleteConfirmationOpen}
          onOpenChange={setIsDeleteConfirmationOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirmDeletion")}</DialogTitle>
            </DialogHeader>
            {t("confirmDeleteMessage")}
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteConfirmationOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteOrder}>
                {t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedInvoiceOrder && (
          <InvoicePreviewDialog
            open={invoiceDialogOpen}
            onOpenChange={setInvoiceDialogOpen}
            invoiceNo={
              selectedInvoiceOrder.invoice_no ||
              `ORD-${selectedInvoiceOrder.id}`
            }
            customer={selectedInvoiceOrder.customer}
            saleDate={
              selectedInvoiceOrder.sale_date || selectedInvoiceOrder.created_at
            }
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
            subtotal={
              selectedInvoiceOrder.subtotal || selectedInvoiceOrder.total_amount
            }
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
      </Card>
    </div>
  );
}
