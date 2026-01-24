"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  FileDown,
  Upload,
  MoreVertical,
  Eye,
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
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  exportCustomersToExcel,
  exportCustomersTemplate,
} from "@/lib/excel-utils";
import { ErrorDialog } from "@/components/error-dialog";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name?: string;
  company_address?: string;
  opening_balance?: number;
  status: "active" | "inactive";
};

export default function CustomersPage() {
  const t = useTranslations("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCompanyName, setNewCustomerCompanyName] = useState("");
  const [newCustomerCompanyAddress, setNewCustomerCompanyAddress] = useState("");
  const [newCustomerOpeningBalance, setNewCustomerOpeningBalance] = useState("");
  const [newCustomerStatus, setNewCustomerStatus] = useState<
    "active" | "inactive"
  >("active");
  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] =
    useState(false);
  const [isViewCustomerDialogOpen, setIsViewCustomerDialogOpen] =
    useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    message: "",
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers");
        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }
        const data = await response.json();
        setCustomers(data);
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (customers.length === 0) return [];
    return customers.filter((customer) => {
      console.log("Filtering customer:", customer);
      if (filters.status !== "all" && customer.status !== filters.status) {
        return false;
      }
      return (
        customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.phone?.includes(searchTerm)
      );
    });
  }, [customers, filters.status, searchTerm]);

  const resetSelectedCustomer = () => {
    setSelectedCustomerId(null);
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setNewCustomerCompanyName("");
    setNewCustomerCompanyAddress("");
    setNewCustomerOpeningBalance("");
    setNewCustomerStatus("active");
  };

  const handleAddCustomer = useCallback(async () => {
    // Validate required fields
    if (!newCustomerName || newCustomerName.trim() === '') {
      setErrorDialog({
        open: true,
        title: 'Validation Error',
        message: 'Customer name is required',
      });
      return;
    }

    setIsSaving(true);
    try {
      const newCustomer = {
        name: newCustomerName,
        email: newCustomerEmail,
        phone: newCustomerPhone,
        company_name: newCustomerCompanyName,
        company_address: newCustomerCompanyAddress,
        opening_balance: newCustomerOpeningBalance ? parseFloat(newCustomerOpeningBalance) : 0,
        status: newCustomerStatus,
      };
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCustomer),
      });

      const text = await response.text();
      let createdCustomer;
      try {
        createdCustomer = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server response error: ${text || response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(createdCustomer.error || "Error creating customer");
      }

      setCustomers([...customers, createdCustomer]);
      setShowNewCustomerDialog(false);
      resetSelectedCustomer();
      
      setErrorDialog({
        open: true,
        title: 'Success',
        message: 'Customer created successfully',
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create customer',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    newCustomerName,
    newCustomerEmail,
    newCustomerPhone,
    newCustomerCompanyName,
    newCustomerCompanyAddress,
    newCustomerOpeningBalance,
    newCustomerStatus,
    customers,
  ]);

  const handleEditCustomer = useCallback(async () => {
    if (!selectedCustomerId) return;

    // Validate required fields
    if (!newCustomerName || newCustomerName.trim() === '') {
      setErrorDialog({
        open: true,
        title: 'Validation Error',
        message: 'Customer name is required',
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedCustomer = {
        id: selectedCustomerId,
        name: newCustomerName,
        email: newCustomerEmail,
        phone: newCustomerPhone,
        company_name: newCustomerCompanyName,
        company_address: newCustomerCompanyAddress,
        opening_balance: newCustomerOpeningBalance ? parseFloat(newCustomerOpeningBalance) : 0,
        status: newCustomerStatus,
      };
      
      const response = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedCustomer),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error updating customer");
      }

      const updatedCustomerData = await response.json();
      setCustomers(
        customers.map((c) =>
          c.id === updatedCustomerData.id ? updatedCustomerData : c,
        ),
      );
      setIsEditCustomerDialogOpen(false);
      resetSelectedCustomer();
      
      setErrorDialog({
        open: true,
        title: 'Success',
        message: 'Customer updated successfully',
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update customer',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedCustomerId,
    newCustomerName,
    newCustomerEmail,
    newCustomerPhone,
    newCustomerCompanyName,
    newCustomerCompanyAddress,
    newCustomerOpeningBalance,
    newCustomerStatus,
    customers,
  ]);

  const handleDeleteCustomer = useCallback(async () => {
    if (!customerToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error deleting customer");
      }

      // Optimistic update
      setCustomers(customers.filter((c) => c.id !== customerToDelete.id));
      setIsDeleteConfirmationOpen(false);
      setCustomerToDelete(null);
      
      setErrorDialog({
        open: true,
        title: 'Success',
        message: 'Customer deleted successfully',
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete customer',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [customerToDelete, customers]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (value: string) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      status: value,
    }));
  };

  const handleDownloadExcel = useCallback(async () => {
    try {
      setIsDownloading(true);
      // Fetch all customers
      const response = await fetch("/api/customers");
      if (!response.ok) {
        throw new Error("Failed to fetch customers");
      }
      const allCustomers = await response.json();

      // Generate filename
      const filename = `customers.xlsx`;

      // Export to Excel
      exportCustomersToExcel(allCustomers, filename);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setErrorDialog({
        open: true,
        title: t("downloadError"),
        message: t("downloadError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [t]);

  const handleDownloadTemplate = useCallback(() => {
    exportCustomersTemplate("customers-template.xlsx");
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls") &&
        !file.type.includes("spreadsheet")
      ) {
        setErrorDialog({
          open: true,
          title: t("importValidationError"),
          message: t("importValidationError"),
        });
        return;
      }

      try {
        setIsImporting(true);
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/customers/import", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("importError"));
        }

        const result = await response.json();
        const message = `${t("importSuccess")}: ${
          result.successCount
        } customer(s) imported.${
          result.errorCount > 0
            ? `\n\n${result.errorCount} error(s) occurred.`
            : ""
        }${
          result.errors && result.errors.length > 0
            ? `\n\nFirst few errors:\n${result.errors.slice(0, 3).join("\n")}`
            : ""
        }`;

        setErrorDialog({
          open: true,
          title: t("importSuccess"),
          message: message,
          isSuccess: result.errorCount === 0,
        });

        // Refresh customers
        const refreshResponse = await fetch("/api/customers");
        if (refreshResponse.ok) {
          const refreshedCustomers = await refreshResponse.json();
          setCustomers(refreshedCustomers);
        }

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Error importing Excel:", error);
        setErrorDialog({
          open: true,
          title: t("importError"),
          message: error instanceof Error ? error.message : t("importError"),
        });
      } finally {
        setIsImporting(false);
      }
    },
    [t],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
        <h1 className="text-2xl font-bold mb-4">Customers</h1>
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
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search customers..."
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
                    checked={filters.status === "active"}
                    onCheckedChange={() => handleFilterChange("active")}
                  >
                    Active
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.status === "inactive"}
                    onCheckedChange={() => handleFilterChange("inactive")}
                  >
                    Inactive
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    disabled={isDownloading || isImporting}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDownloadExcel}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {isDownloading ? t("downloading") : t("downloadExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadTemplate}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("downloadTemplate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleImportClick}
                    disabled={isDownloading || isImporting}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? t("importing") : t("import")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <Button size="sm" onClick={() => setShowNewCustomerDialog(true)}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </div>
          </div>

          {/* Mobile/Tablet Layout */}
          <div className="md:hidden flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pr-8"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-9">
                    <FilterIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
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
                    checked={filters.status === "active"}
                    onCheckedChange={() => handleFilterChange("active")}
                  >
                    Active
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.status === "inactive"}
                    onCheckedChange={() => handleFilterChange("inactive")}
                  >
                    Inactive
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                onClick={() => setShowNewCustomerDialog(true)}
                className="h-9 min-h-[44px]"
              >
                <PlusCircle className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0 min-h-[44px]"
                    disabled={isDownloading || isImporting}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDownloadExcel}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {isDownloading ? t("downloading") : t("downloadExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadTemplate}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("downloadTemplate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleImportClick}
                    disabled={isDownloading || isImporting}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? t("importing") : t("import")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.company_name || '-'}</TableCell>
                    <TableCell>Rs. {customer.opening_balance ? Math.round(customer.opening_balance) : '0'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setViewCustomer(customer);
                            setIsViewCustomerDialogOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="sr-only">View</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedCustomerId(customer.id);
                            setNewCustomerName(customer.name);
                            setNewCustomerEmail(customer.email);
                            setNewCustomerPhone(customer.phone);
                            setNewCustomerCompanyName(customer.company_name || "");
                            setNewCustomerCompanyAddress(customer.company_address || "");
                            setNewCustomerOpeningBalance(customer.opening_balance?.toString() || "");
                            setNewCustomerStatus(customer.status);
                            setIsEditCustomerDialogOpen(true);
                          }}
                        >
                          <FilePenIcon className="w-4 h-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setCustomerToDelete(customer);
                            setIsDeleteConfirmationOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
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
          open={showNewCustomerDialog || isEditCustomerDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setShowNewCustomerDialog(false);
              setIsEditCustomerDialogOpen(false);
              resetSelectedCustomer();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {showNewCustomerDialog
                  ? "Create New Customer"
                  : "Edit Customer"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name<span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Phone</Label>
                <Input
                  id="phone"
                  value={newCustomerPhone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                    setNewCustomerPhone(value);
                  }}
                  maxLength={11}
                  placeholder="03001234567"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company_name" className="text-right">Company Name</Label>
                <Input
                  id="company_name"
                  value={newCustomerCompanyName}
                  onChange={(e) => setNewCustomerCompanyName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company_address" className="text-right">Company Address</Label>
                <Input
                  id="company_address"
                  value={newCustomerCompanyAddress}
                  onChange={(e) => setNewCustomerCompanyAddress(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="opening_balance" className="text-right">Opening Balance (To Receive)</Label>
                <Input
                  id="opening_balance"
                  type="number"
                  value={newCustomerOpeningBalance}
                  onChange={(e) => setNewCustomerOpeningBalance(e.target.value)}
                  className="col-span-3"
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewCustomerDialog(false);
                  setIsEditCustomerDialogOpen(false);
                  resetSelectedCustomer();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={
                  showNewCustomerDialog ? handleAddCustomer : handleEditCustomer
                }
                disabled={!newCustomerName || newCustomerName.trim() === '' || isSaving}
              >
                {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                {showNewCustomerDialog ? "Create Customer" : "Update Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isViewCustomerDialogOpen}
          onOpenChange={setIsViewCustomerDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">Name:</Label>
                <div className="col-span-3">{viewCustomer?.name}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">Phone:</Label>
                <div className="col-span-3">{viewCustomer?.phone || '-'}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">Email:</Label>
                <div className="col-span-3">{viewCustomer?.email || '-'}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">Company Name:</Label>
                <div className="col-span-3">{viewCustomer?.company_name || '-'}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">Company Address:</Label>
                <div className="col-span-3">{viewCustomer?.company_address || '-'}</div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">Opening Balance:</Label>
                <div className="col-span-3">
                  Rs. {viewCustomer?.opening_balance ? Math.round(viewCustomer.opening_balance) : '0'}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setIsViewCustomerDialogOpen(false)}
              >
                Close
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
            Are you sure you want to delete this customer? This action cannot be
            undone.
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteConfirmationOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteCustomer} disabled={isDeleting}>
                {isDeleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
          title={errorDialog.title}
          message={errorDialog.message}
          isSuccess={errorDialog.isSuccess}
        />
      </Card>
    </div>
  );
}
