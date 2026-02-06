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
import { exportCustomersToExcel, exportCustomersTemplate } from "@/lib/excel";
import { ErrorDialog } from "@/components/dialogs/error-dialog";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name?: string;
  company_address?: string;
  balance?: number;
  status: "active" | "inactive";
  is_delete?: number;
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
  const [newCustomerCompanyAddress, setNewCustomerCompanyAddress] =
    useState("");
  const [newCustomerOpeningBalance, setNewCustomerOpeningBalance] =
    useState("");
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
        const activeCustomers = data.filter(
          (customer: Customer) => customer.is_delete !== 1,
        );
        setCustomers(activeCustomers);
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
      if (customer.is_delete === 1) {
        return false;
      }
      return (
        customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.phone?.includes(searchTerm)
      );
    });
  }, [customers, searchTerm]);

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
    if (!newCustomerName || newCustomerName.trim() === "") {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("customerNameRequired"),
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
        balance: newCustomerOpeningBalance
          ? parseFloat(newCustomerOpeningBalance)
          : 0,
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
        throw new Error(
          `Server response error: ${text || response.statusText}`,
        );
      }

      if (!response.ok) {
        throw new Error(createdCustomer.error || "Error creating customer");
      }

      setCustomers([...customers, createdCustomer]);
      setShowNewCustomerDialog(false);
      resetSelectedCustomer();

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("customerCreatedSuccess"),
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message:
          error instanceof Error ? error.message : t("failedToCreateCustomer"),
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
    t,
  ]);

  const handleEditCustomer = useCallback(async () => {
    if (!selectedCustomerId) return;

    if (!newCustomerName || newCustomerName.trim() === "") {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("customerNameRequired"),
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
        balance: newCustomerOpeningBalance
          ? parseFloat(newCustomerOpeningBalance)
          : 0,
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
          c.id === updatedCustomerData.id || c.id === selectedCustomerId
            ? {
                ...updatedCustomerData,
                balance:
                  typeof updatedCustomerData.balance === "undefined"
                    ? typeof updatedCustomerData.opening_balance !== "undefined"
                      ? updatedCustomerData.opening_balance
                      : c.balance
                    : updatedCustomerData.balance,
              }
            : c,
        ),
      );
      setIsEditCustomerDialogOpen(false);
      resetSelectedCustomer();

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("customerUpdatedSuccess"),
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message:
          error instanceof Error ? error.message : t("failedToUpdateCustomer"),
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

    if (
      customerToDelete.balance !== 0 &&
      customerToDelete.balance !== undefined &&
      customerToDelete.balance !== null
    ) {
      setErrorDialog({
        open: true,
        title: t("cannotDelete"),
        message:
          t("cannotDeleteMessage") +
          Math.round(customerToDelete.balance || 0),
      });
      setIsDeleteConfirmationOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customers/${customerToDelete.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_delete: 1 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error deleting customer");
      }

      setCustomers(
        customers.map((c) =>
          c.id === customerToDelete.id ? { ...c, is_delete: 1 } : c,
        ),
      );
      setIsDeleteConfirmationOpen(false);
      setCustomerToDelete(null);

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("customerDeletedSuccess"),
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message:
          error instanceof Error ? error.message : t("failedToDeleteCustomer"),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [customerToDelete, customers, t]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDownloadExcel = useCallback(async () => {
    try {
      setIsDownloading(true);
      const response = await fetch("/api/customers");
      if (!response.ok) {
        throw new Error("Failed to fetch customers");
      }
      const allCustomers = await response.json();

      const filename = `customers.xlsx`;

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
        const refreshResponse = await fetch("/api/customers");
        if (refreshResponse.ok) {
          const refreshedCustomers = await refreshResponse.json();
          setCustomers(refreshedCustomers);
        }
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
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
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
                  <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
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
                {t("addCustomer")}
              </Button>
            </div>
          </div>

          {/* Mobile/Tablet Layout */}
          <div className="md:hidden flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pr-8 h-9 text-sm"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <Button
                size="sm"
                onClick={() => setShowNewCustomerDialog(true)}
                className="h-9 px-3 flex-shrink-0"
              >
                <PlusCircle className="w-4 h-4 mr-1" />
                <span className="text-xs">{t("add")}</span>
              </Button>
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
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
        <CardContent className="p-0 md:p-6">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("phoneLabel")}</TableHead>
                    <TableHead>{t("companyName")}</TableHead>
                    <TableHead>{t("balance")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>{customer.company_name || "-"}</TableCell>
                      <TableCell>
                        Rs.{" "}
                        {customer.balance ? Math.round(customer.balance) : "0"}
                      </TableCell>
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
                            <span className="sr-only">{t("view")}</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCustomerId(customer.id);
                              setNewCustomerName(customer.name);
                              setNewCustomerEmail(customer.email);
                              setNewCustomerPhone(customer.phone);
                              setNewCustomerCompanyName(
                                customer.company_name || "",
                              );
                              setNewCustomerCompanyAddress(
                                customer.company_address || "",
                              );
                              setNewCustomerOpeningBalance(
                                customer.balance?.toString() || "",
                              );
                              setNewCustomerStatus(customer.status);
                              setIsEditCustomerDialogOpen(true);
                            }}
                          >
                            <FilePenIcon className="w-4 h-4" />
                            <span className="sr-only">{t("edit")}</span>
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
                            <span className="sr-only">{t("deleteAction")}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile View - Cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
              >
                <div className="space-y-3">
                  {/* Header with Name and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.phone || "-"}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setViewCustomer(customer);
                          setIsViewCustomerDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="sr-only">{t("view")}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedCustomerId(customer.id);
                          setNewCustomerName(customer.name);
                          setNewCustomerEmail(customer.email);
                          setNewCustomerPhone(customer.phone);
                          setNewCustomerCompanyName(
                            customer.company_name || "",
                          );
                          setNewCustomerCompanyAddress(
                            customer.company_address || "",
                          );
                          setNewCustomerOpeningBalance(
                            customer.balance?.toString() || "",
                          );
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
                        className="h-8 w-8"
                        onClick={() => {
                          setCustomerToDelete(customer);
                          setIsDeleteConfirmationOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">{t("deleteAction")}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Company and Balance */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("companyName")}
                      </p>
                      <p className="font-semibold text-sm">
                        {customer.company_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("balance")}
                      </p>
                      <p className="font-semibold text-sm">
                        {t("currencySymbol")}{" "}
                        {customer.balance ? Math.round(customer.balance) : "0"}
                      </p>
                    </div>
                  </div>

                  {/* Company Address */}
                  {customer.company_address && (
                    <div className="w-full">
                      <p className="text-xs text-muted-foreground mb-1">
                        Company Address
                      </p>
                      <p className="text-xs text-foreground line-clamp-2">
                        {customer.company_address}
                      </p>
                    </div>
                  )}

                  {/* Email */}
                  {customer.email && (
                    <div className="w-full">
                      <p className="text-xs text-muted-foreground mb-1">
                        Email
                      </p>
                      <p className="text-xs text-foreground break-all">
                        {customer.email}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
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
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl">
                {showNewCustomerDialog
                  ? t("createNewCustomer")
                  : t("editCustomerTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
              {/* Contact Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("contactInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-xs sm:text-sm font-medium"
                    >
                      {t("nameLabel")}<span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-xs sm:text-sm font-medium"
                    >
                      {t("phoneLabel")}
                    </Label>
                    <Input
                      id="phone"
                      value={newCustomerPhone}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 11);
                        setNewCustomerPhone(value);
                      }}
                      maxLength={11}
                      placeholder={t("phonePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {t("emailLabel")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Company Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("companyInformation")}
                </h3>
                <div className="space-y-2">
                  <Label
                    htmlFor="company_name"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {t("companyNameLabel")}
                  </Label>
                  <Input
                    id="company_name"
                    value={newCustomerCompanyName}
                    onChange={(e) => setNewCustomerCompanyName(e.target.value)}
                    placeholder={t("companyNamePlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="company_address"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {t("companyAddressLabel")}
                  </Label>
                  <Input
                    id="company_address"
                    value={newCustomerCompanyAddress}
                    onChange={(e) =>
                      setNewCustomerCompanyAddress(e.target.value)
                    }
                    placeholder={t("companyAddressPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Financial Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("financialInformation")}
                </h3>
                <div className="space-y-2">
                  <Label
                    htmlFor="balance"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {showNewCustomerDialog ? t("openingBalance") : t("balanceLabel")}
                  </Label>
                  <Input
                    id="balance"
                    type="number"
                    value={newCustomerOpeningBalance}
                    onChange={(e) =>
                      setNewCustomerOpeningBalance(e.target.value)
                    }
                    placeholder={t("balancePlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("openingBalanceHelper")}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewCustomerDialog(false);
                  setIsEditCustomerDialogOpen(false);
                  resetSelectedCustomer();
                }}
                className="h-9 sm:h-10 w-full sm:w-auto"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={
                  showNewCustomerDialog ? handleAddCustomer : handleEditCustomer
                }
                disabled={
                  !newCustomerName || newCustomerName.trim() === "" || isSaving
                }
                className="h-9 sm:h-10 w-full sm:w-auto sm:min-w-[120px]"
              >
                {isSaving && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {showNewCustomerDialog ? t("createCustomer") : t("updateCustomer")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isViewCustomerDialogOpen}
          onOpenChange={setIsViewCustomerDialogOpen}
        >
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl">
                {t("customerDetails")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("contactInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("nameLabel")}</span>
                    <div className="text-sm sm:text-base font-medium">
                      {viewCustomer?.name || "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("phoneLabel")}</span>
                    <div className="text-sm sm:text-base font-medium">
                      {viewCustomer?.phone || "-"}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("emailLabel")}</span>
                  <div className="text-sm sm:text-base font-medium">
                    {viewCustomer?.email || "-"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("companyInformation")}
                </h3>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t("companyNameLabel")}
                  </span>
                  <div className="text-sm sm:text-base font-medium">
                    {viewCustomer?.company_name || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t("companyAddressLabel")}
                  </span>
                  <div className="text-sm sm:text-base font-medium">
                    {viewCustomer?.company_address || "-"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("financialInformation")}
                </h3>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("balanceLabel")}</span>
                  <div className="text-sm sm:text-base font-medium">
                    {t("currencySymbol")}{" "}
                    {viewCustomer?.balance
                      ? Math.round(viewCustomer.balance)
                      : "0"}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => setIsViewCustomerDialogOpen(false)}
                className="h-9 sm:h-10 w-full sm:w-auto"
              >
                {t("close")}
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
                disabled={isDeleting}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("delete")}
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
