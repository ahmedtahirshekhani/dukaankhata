"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
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
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";

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
  };
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  charges?: Array<{
    item: string;
    value: number;
  }>;
  payment?: {
    method: string;
    paid_amount: number;
    paid_date: string;
    no_payment_at_all: boolean;
  } | null;
};

export default function OrdersPage() {
  const t = useTranslations("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState("");
  const [newOrderTotal, setNewOrderTotal] = useState("");
  const [newOrderStatus, setNewOrderStatus] = useState<"completed" | "pending" | "cancelled">("pending");
  const [isEditOrderDialogOpen, setIsEditOrderDialogOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
  });
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders");
        if (!response.ok) {
          throw new Error("Failed to fetch orders");
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
        created_at: new Date().toISOString().split('T')[0], // Current created_at in YYYY-MM-DD format
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newOrder),
      });

      if (!response.ok) {
        throw new Error("Error creating order");
      }

      const createdOrder = await response.json();
      setOrders([...orders, createdOrder]);
      setShowNewOrderDialog(false);
      resetSelectedOrder();
    } catch (error) {
      console.error(error);
    }
  }, [newOrderTotal, newOrderStatus, orders]);

  const handleEditOrder = useCallback(async () => {
    if (!selectedOrderId) return;
    try {
      const updatedOrder = {
        id: selectedOrderId,
        total_amount: parseFloat(newOrderTotal),
        status: newOrderStatus,
        created_at: orders.find(o => o.id === selectedOrderId)?.created_at, // Preserve the original created_at
      };
      const response = await fetch(`/api/orders/${selectedOrderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedOrder),
      });

      if (!response.ok) {
        throw new Error("Error updating order");
      }

      const updatedOrderData = await response.json();
      setOrders(orders.map((o) => (o.id === updatedOrderData.id ? updatedOrderData : o)));
      setIsEditOrderDialogOpen(false);
      resetSelectedOrder();
    } catch (error) {
      console.error(error);
    }
  }, [selectedOrderId, newOrderTotal, newOrderStatus, orders]);

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
  }, [orderToDelete, orders]);

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
        <h1 className="text-2xl font-bold mb-4">Orders</h1>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search orders..."
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
                  <span>Filters</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters.status === "all"}
                  onCheckedChange={() => handleFilterChange("all")}
                >
                  All Statuses
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.status === "completed"}
                  onCheckedChange={() => handleFilterChange("completed")}
                >
                  Completed
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.status === "pending"}
                  onCheckedChange={() => handleFilterChange("pending")}
                >
                  Pending
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.status === "cancelled"}
                  onCheckedChange={() => handleFilterChange("cancelled")}
                >
                  Cancelled
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.invoice_no || `ORD-${order.id}`}</TableCell>
                  <TableCell>{order.customer.name}</TableCell>
                  <TableCell>
                    Rs. {Math.floor(order.total_amount)}
                  </TableCell>
                  <TableCell>
                    Rs. {Math.floor(order.payment?.paid_amount || 0)}
                  </TableCell>
                  <TableCell>
                    Rs. {Math.floor(order.total_amount - (order.payment?.paid_amount || 0))}
                  </TableCell>
                  <TableCell>
                    {new Date(order.sale_date || order.created_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
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
                        style={{display: "none"}} 
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Delete</span>
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
                        <span className="sr-only">Show Invoice</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              {showNewOrderDialog ? "Create New Order" : "Edit Order"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                value={newOrderCustomerName}
                onChange={(e) => setNewOrderCustomerName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                value={newOrderTotal}
                onChange={(e) => setNewOrderTotal(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status">Status</Label>
              <Select
                value={newOrderStatus}
                onValueChange={(value: "completed" | "pending" | "cancelled") =>
                  setNewOrderStatus(value)
                }
              >
                <SelectTrigger id="status" className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
              Cancel
            </Button>
            <Button onClick={showNewOrderDialog ? handleAddOrder : handleEditOrder}>
              {showNewOrderDialog ? "Create Order" : "Update Order"}
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
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          Are you sure you want to delete this order? This action cannot be undone.
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsDeleteConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrder}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedInvoiceOrder && (
        <InvoicePreviewDialog
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          invoiceNo={selectedInvoiceOrder.invoice_no || `ORD-${selectedInvoiceOrder.id}`}
          customerName={selectedInvoiceOrder.customer.name}
          saleDate={selectedInvoiceOrder.sale_date || selectedInvoiceOrder.created_at}
          dueDate={selectedInvoiceOrder.due_date || null}
          products={(selectedInvoiceOrder.items || []).map((item, index) => ({
            id: index,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          }))}
          subtotal={selectedInvoiceOrder.subtotal || selectedInvoiceOrder.total_amount}
          charges={selectedInvoiceOrder.charges || []}
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
