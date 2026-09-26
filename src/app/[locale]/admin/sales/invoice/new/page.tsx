"use client";

export const dynamic = "force-dynamic";

import React, { useRef, useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { ItemSelectTable } from "@/components/invoice/item-select-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoicePreviewDialog } from "@/components/invoice/invoice-preview-dialog";
import {
  InvoicePreview,
  type InvoiceProduct,
  type InvoiceCharge,
} from "@/components/invoice/invoice-preview";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { calculateLineTotal } from "@/lib/invoice/calculations";
import { XIcon, Loader2Icon, ArrowLeftIcon } from "lucide-react";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";
import { generateReferenceNumber } from "@/lib/utils";

import { DatePicker } from "@/components/ui/date-picker";

const getTodayDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export type Product = {
  id: number | string;
  name: string;
  description?: string;
  sell_price: number;
  cost_price?: number;
  price?: number;
  unit_of_measurement?: string;
  quantity?: number;
  in_stock?: number;
  damaged_quantity?: number;
  type?: string;
};

type Customer = {
  id: number | string;
  _id?: number | string;
  name: string;
  email?: string;
  phone?: string;
  type?: string;
};

export interface POSProduct extends Product {
  quantity: number;
  quantityInput?: string;
  quantityType?: "prime" | "damaged";
  discount?: number;
  discountType?: "value" | "percentage";
  discountInput?: string;
  sellPriceInput?: string;
  hadNoUomOriginally?: boolean;
}

export default function NewInvoicePage() {
  const t = useTranslations("invoice");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const editOrderId = searchParams.get("edit");
  const locale = useLocale();

  const { data: session } = useSession();
  const [selectedProducts, setSelectedProducts] = useState<POSProduct[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [addDueDate, setAddDueDate] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<string>(getTodayDateString());
  const [todayIso, setTodayIso] = useState<string>(getTodayDateString());
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
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showOrderCreatedDialog, setShowOrderCreatedDialog] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [showSaveErrorDialog, setShowSaveErrorDialog] = useState(false);
  const [createdOrderShareData, setCreatedOrderShareData] = useState<{
    customerName: string;
    phone: string;
    customerEmail?: string;
    invoiceNo: string;
    saleDate: string;
    dueDate: string | null;
    products: InvoiceProduct[];
    subtotal: number;
    charges: InvoiceCharge[];
    overallDiscount: number;
    shippingCharges: number;
    total: number;
    paidAmount: number;
    paidDate: string | null;
    noPaymentAtAll: boolean;
    companyName: string;
    customerNotes: string;
  } | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const invoiceShareRef = useRef<HTMLDivElement | null>(null);

  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [orderSaved, setOrderSaved] = useState(false);

  const isCashSale = selectedCustomer?.name?.toLowerCase()?.includes("cash") || selectedCustomer?.type === "cash";

  const getSalePrice = (product: POSProduct) => product.sell_price;
  const sanitizeOverallDiscount = (
    value: number,
    type: "value" | "percentage" = overallDiscountType,
  ) => {
    if (Number.isNaN(value)) return 0;
    const positive = Math.max(0, value);
    return type === "percentage" ? Math.min(positive, 100) : positive;
  };

  const handleOverallDiscountInputChange = (rawValue: string) => {
    const value = parseFloat(rawValue);
    setOverallDiscount(sanitizeOverallDiscount(value));
  };

  const handleOverallDiscountTypeChange = (type: "value" | "percentage") => {
    setOverallDiscountType(type);
    setOverallDiscount((prev) => sanitizeOverallDiscount(prev, type));
  };

  const formatUom = (uom?: string) =>
    uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-";
  const truncateDescription = (desc?: string, limit = 100) => {
    if (!desc) return "";
    return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
  };
  const normalizeQuantity = (value: number, fallback = 1) => {
    if (Number.isNaN(value)) return fallback;
    return Math.max(0, value);
  };

  useEffect(() => {
    const loadEditOrder = async () => {
      if (editOrderId) {
        try {
          const order = await db.orders.get(editOrderId);
          if (order) {
            if (!order.invoice_no) {
              setInvoiceNo(generateReferenceNumber("INV"));
            } else {
              setInvoiceNo(order.invoice_no);
            }
            setSelectedDate(order.sale_date?.split("T")[0] || getTodayDateString());
            if (order.due_date) {
              setAddDueDate(true);
              setDueDate(order.due_date.split("T")[0]);
            } else {
              setAddDueDate(false);
            }

            const customer = await db.parties.get(order.customer_id);
            if (customer) {
              setSelectedCustomer({
                id: customer.id,
                _id: customer._id || customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email
              });
            }

            let orderItems = order.items;
            if (typeof orderItems === "string") {
              try { orderItems = JSON.parse(orderItems); } catch (e) { }
            }

            if (orderItems && Array.isArray(orderItems)) {
              const items: POSProduct[] = orderItems.map((item: any) => ({
                id: item.product_id || item.id,
                name: item.name,
                description: item.description,
                quantity: normalizeQuantity(Number(item.quantity ?? 1)),
                quantityInput: item.quantity_str || String(normalizeQuantity(Number(item.quantity ?? 1))),
                quantityType: item.quantityType || "prime",
                sell_price: item.price ?? item.sell_price ?? 0,
                sellPriceInput: String(item.price ?? item.sell_price ?? 0),
                discount: parseFloat(item.discount) || 0,
                discountType: item.discountType || "value",
                discountInput: String(item.discount || "0"),
                unit_of_measurement: item.unit_of_measurement
              }));
              setSelectedProducts(items);
            }

            setCharges(order.charges || []);
            setOverallDiscount(parseFloat(order.overallDiscount?.toString() || "0"));
            setShippingCharges(parseFloat(order.shippingCharges?.toString() || "0"));
            if (order.customer_notes) setCustomerNotes(order.customer_notes);

            if (order.payment && !order.payment.no_payment_at_all) {
              setPaymentMethod(order.payment.method || "");
              setPaymentAmount(order.payment.paid_amount || 0);
            }
          }
        } catch (error) {
          console.error("Error loading order for edit:", error);
        }
      } else {
        generateInvoiceNo();
      }
    };
    loadEditOrder();
  }, [editOrderId]);

  useEffect(() => {
    setCustomerNotes((prev) =>
      prev === "" ? t("thanksForYourBusiness") : prev,
    );
  }, [t]);

  const generateInvoiceNo = () => {
    setInvoiceNo(generateReferenceNumber("INV"));
  };

  const handleClear = () => {
    setSelectedProducts([]);
    setSelectedCustomer(null);
    generateInvoiceNo();
    setSelectedDate(getTodayDateString());
    setAddDueDate(false);
    setDueDate(getTodayDateString());
    setCharges([]);
    setShowAddCharge(false);
    setNewChargeItem("");
    setNewChargeValue("");
    setOverallDiscount(0);
    setOverallDiscountType("value");
    setShippingCharges(0);
    setCustomerNotes("");
    setPaymentAmount("");
    setPaymentMethod("");
    setSaveError("");
    setCreatedOrderShareData(null);
  };

  const handleSelectProduct = (product: Product) => {
    const productId = product.id;
    if (!product) return;
    setSaveError("");
    const hadNoUom =
      !product.unit_of_measurement ||
      product.unit_of_measurement.trim() === "" ||
      product.unit_of_measurement === "-" ||
      product.unit_of_measurement === "none";

    if (selectedProducts.some((p) => p.id === productId)) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.id === productId
            ? {
              ...p,
              quantity: p.quantity + 1,
              quantityInput: String(p.quantity + 1),
            }
            : p,
        ),
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          ...product,
          quantity: 1,
          quantityInput: "1",
          quantityType: "prime",
          sell_price: product.sell_price ?? 0,
          sellPriceInput: String(product.sell_price ?? 0),
          discount: 0,
          discountType: "value",
          discountInput: "0",
          hadNoUomOriginally: hadNoUom,
          unit_of_measurement: product.unit_of_measurement || "",
        },
      ]);
    }
  };

  const handleRowProductChange = (oldId: number | string, newProduct: Product, isSync?: boolean) => {
    if (!newProduct) return;
    const hadNoUom =
      !newProduct.unit_of_measurement ||
      newProduct.unit_of_measurement.trim() === "" ||
      newProduct.unit_of_measurement === "-" ||
      newProduct.unit_of_measurement === "none";
    
    setSelectedProducts((current) => {
      return current.map((p) => {
        if (p.id === oldId) {
          const isSameProduct = isSync || p.name === newProduct.name;
          return {
            ...p,
            id: newProduct.id,
            name: newProduct.name,
            description: newProduct.description,
            unit_of_measurement: newProduct.unit_of_measurement || "",
            hadNoUomOriginally: hadNoUom,
            ...(isSameProduct ? {} : {
              sell_price: newProduct.sell_price ?? 0,
              sellPriceInput: String(newProduct.sell_price ?? 0)
            })
          };
        }
        return p;
      });
    });
  };

  const handleUomChange = (productId: number | string, newUom: string) => {
    setSelectedProducts((current) =>
      current.map((p) =>
        p.id === productId
          ? {
              ...p,
              unit_of_measurement: newUom,
            }
          : p
      )
    );
  };

  const handleSelectCustomer = (customerId: string, customer?: Customer) => {
    if (!customer) return;
    if (customer) {
      setSelectedCustomer(customer);
      setSaveError("");
    }
  };

  const handleQuantityChange = (
    productId: number | string,
    rawQuantity: string,
  ) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId
          ? {
            ...p,
            quantityInput: rawQuantity,
            quantity:
              rawQuantity.trim() === ""
                ? p.quantity
                : normalizeQuantity(Number.parseFloat(rawQuantity), p.quantity),
          }
          : p,
      ),
    );
  };

  const handleQuantityBlur = (productId: number | string) => {
    setSelectedProducts((current) =>
      current.map((p) =>
        p.id === productId
          ? {
            ...p,
            quantityInput: p.quantityInput?.trim() && !Number.isNaN(Number.parseFloat(p.quantityInput))
              ? p.quantityInput
              : String(p.quantity),
          }
          : p,
      ),
    );
  };

  const handleDiscountChange = (
    productId: number | string,
    newDiscount: number,
  ) => {
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

  const handleSellPriceChange = (
    productId: number | string,
    rawSellPrice: string,
  ) => {
    const parsedPrice = parseFloat(rawSellPrice);
    const safePrice = Number.isNaN(parsedPrice)
      ? 0
      : Math.max(0, parsedPrice);
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.id === productId
          ? {
            ...p,
            sell_price: safePrice,
            sellPriceInput: rawSellPrice,
          }
          : p,
      ),
    );
  };

  const handleSellPriceBlur = (productId: number | string) => {
    setSelectedProducts((current) =>
      current.map((p) =>
        p.id === productId
          ? {
            ...p,
            sellPriceInput: String(p.sell_price),
          }
          : p,
      ),
    );
  };

  const handleRemoveProduct = (productId: number | string) => {
    const target = selectedProducts.find((p) => p.id === productId);
    if (!target) return;

    if (target.quantity > 1) {
      handleQuantityChange(productId, String(target.quantity - 1));
      return;
    }

    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
    setSaveError("");
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
  const overallDiscountNum = sanitizeOverallDiscount(overallDiscount || 0);
  const overallDiscountAmount =
    overallDiscountType === "percentage"
      ? (total * overallDiscountNum) / 100
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
    if (!selectedCustomer || selectedProducts.length === 0) {
      setSaveError(t("selectPartyAndItemsError"));
      setShowSaveErrorDialog(true);
      return;
    }

    if (!isCashSale && paymentAmount !== "" && paymentAmount > 0) {
      if (paymentAmount > Math.floor(finalTotal)) {
        setSaveError(t("paymentGreaterError") || "Payment cannot be greater than Total Amount");
        setShowSaveErrorDialog(true);
        return;
      }
      if (!paymentMethod) {
        setSaveError(t("paymentMethodRequired") || "Payment Method is required");
        setShowSaveErrorDialog(true);
        return;
      }
    }

    setSaveError("");
    if (!invoiceNo) {
      return;
    }

    // Check for products exceeding available stock (only for goods type)
    const items: { name: string; requested: number; inStock: number }[] = [];
    for (const selected of selectedProducts) {
      const product = selected;
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

    executeCreateOrder();
  };

  const executeCreateOrder = async () => {
    const saleDateISO = selectedDate ? (selectedDate.includes('T') ? selectedDate : `${selectedDate}T12:00:00.000Z`) : new Date().toISOString();
    if (isCashSale) {
      await handleCreateOrder({
        paidAmount: Math.floor(finalTotal),
        paymentMethod: paymentMethod || "cash",
        paidDate: saleDateISO,
        noPaymentAtAll: false,
      });
    } else {
      const pAmount = paymentAmount === "" ? 0 : paymentAmount;
      await handleCreateOrder({
        paidAmount: pAmount > 0 ? pAmount : 0,
        paymentMethod: pAmount > 0 ? paymentMethod : "",
        paidDate: saleDateISO,
        noPaymentAtAll: pAmount === 0,
      });
    }
  };

  const handleOverstockConfirm = () => {
    setShowOverstockDialog(false);
    setOverstockItems([]);
    executeCreateOrder();
  };

  const handleOverstockCancel = () => {
    setOverstockItems([]);
  };

  const normalizeWhatsAppNumber = (phone?: string) => {
    if (!phone) return "";
    let normalized = phone.replace(/[^\d+]/g, "");

    if (normalized.startsWith("0")) {
      normalized = `+92${normalized.slice(1)}`;
    } else if (!normalized.startsWith("+") && normalized.startsWith("92")) {
      normalized = `+${normalized}`;
    } else if (!normalized.startsWith("+")) {
      normalized = `+${normalized}`;
    }

    return normalized;
  };

  const getWhatsAppNumberForLink = () => {
    const phone = normalizeWhatsAppNumber(createdOrderShareData?.phone);
    return phone.replace(/\D/g, "");
  };

  const getWhatsAppLink = () => {
    if (!createdOrderShareData) return "";
    const normalizedNumber = getWhatsAppNumberForLink();
    if (!normalizedNumber) return "";

    const message = t("whatsappOrderMessage", {
      customerName: createdOrderShareData.customerName || t("customer"),
      invoiceNo: createdOrderShareData.invoiceNo,
      currency: t("currencySymbol"),
      total: Math.floor(createdOrderShareData.total),
    });

    return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleSendInvoicePdfOnWhatsApp = async () => {
    if (!createdOrderShareData || !invoiceShareRef.current) return;

    const whatsappNumber = getWhatsAppNumberForLink();
    if (!whatsappNumber) return;

    setIsSendingWhatsApp(true);
    try {
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      const pdfBlob: Blob = await html2pdf()
        .set({
          margin: 10,
          filename: `${createdOrderShareData.invoiceNo}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(invoiceShareRef.current)
        .outputPdf("blob");

      const message = t("whatsappOrderMessage", {
        customerName: createdOrderShareData.customerName || t("customer"),
        invoiceNo: createdOrderShareData.invoiceNo,
        currency: t("currencySymbol"),
        total: Math.floor(createdOrderShareData.total),
      });

      const pdfFile = new File(
        [pdfBlob],
        `${createdOrderShareData.invoiceNo}.pdf`,
        {
          type: "application/pdf",
        },
      );

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          files: [pdfFile],
          title: createdOrderShareData.invoiceNo,
          text: message,
        });
        return;
      }

      const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappLink, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to send invoice PDF on WhatsApp:", error);
    } finally {
      setIsSendingWhatsApp(false);
    }
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

    const shareData = {
      customerName: selectedCustomer.name,
      phone: selectedCustomer.phone || "",
      customerEmail: selectedCustomer.email || "",
      invoiceNo,
      saleDate: selectedDate,
      dueDate: addDueDate ? dueDate : null,
      products: selectedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        quantity: p.quantity,
        quantity_str: p.quantityInput || String(p.quantity),
        quantityType: p.quantityType,
        sell_price: p.sell_price,
        unit_of_measurement: p.unit_of_measurement,
        discount: p.discount,
        discountType: p.discountType,
      })),
      subtotal: total,
      charges: displayCharges.map((c) => ({ item: c.item, value: c.value })),
      overallDiscount: overallDiscountAmount,
      shippingCharges: shippingChargesNum,
      total: finalTotal,
      paidAmount: paymentDetails.paidAmount,
      paidDate: paymentDetails.paidDate,
      noPaymentAtAll: paymentDetails.noPaymentAtAll,
      companyName: session?.user?.company || session?.user?.name || "",
      customerNotes,
    };

    setIsCreatingOrder(true);
    try {
      const payload = {
        invoiceNo,
        customerId: selectedCustomer.id,
        saleDate: selectedDate,
        dueDate: addDueDate ? dueDate : null,
        products: selectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          quantity: p.quantity,
          quantity_str: p.quantityInput || String(p.quantity),
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
        customerNotes,
      };

      const now = new Date().toISOString();
      const localOrderId = editOrderId || `local_order_${Date.now()}`;
      const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');

      // 1. If editing, revert old stock and balance
      if (editOrderId) {
        const oldOrder = await db.orders.get(editOrderId);
        if (oldOrder) {
          // Revert old stock
          if (oldOrder.items && Array.isArray(oldOrder.items)) {
            for (const item of oldOrder.items) {
              if (item.product_id) {
                const productDoc = await db.products.get(item.product_id.toString());
                if (productDoc && (!productDoc.type || productDoc.type === "goods" || productDoc.type === "good")) {
                  if (item.quantityType === "damaged") {
                    const currentQty = parseFloat(productDoc.damaged_quantity?.toString() || "0");
                    const newQty = Math.round((currentQty + (Number(item.quantity) || 0)) * 100000) / 100000;
                    await db.products.update(item.product_id.toString(), { damaged_quantity: newQty });
                  } else {
                    await adjustOfflineStock(item.product_id.toString(), Number(item.quantity) || 0);
                  }
                }
              }
            }
          }

          // Revert old balance
          const oldPaid = oldOrder.payment && !oldOrder.payment.no_payment_at_all ? (oldOrder.payment.paid_amount || 0) : 0;
          const oldNetAmount = (oldOrder.total_amount || 0) - oldPaid;
          if (oldNetAmount !== 0 && oldOrder.customer_id) {
            await updateOfflinePartyBalance(oldOrder.customer_id.toString(), -oldNetAmount);
          }
        }
      }

      // 2. Insert or Update Order locally
      const orderData: any = {
        id: localOrderId,
        customer_id: (selectedCustomer.id || (selectedCustomer as any)._id || "").toString(),
        total_amount: finalTotal,
        subtotal: total,
        invoice_no: invoiceNo || null,
        sale_date: selectedDate || now,
        due_date: addDueDate ? dueDate : null,
        charges: displayCharges,
        overallDiscount: overallDiscountAmount,
        shippingCharges: shippingChargesNum,
        payment: paymentDetails.noPaymentAtAll ? null : {
          method: paymentDetails.paymentMethod,
          paid_amount: paymentDetails.paidAmount || 0,
          paid_date: paymentDetails.paidDate || null,
          no_payment_at_all: paymentDetails.noPaymentAtAll
        },
        customer_notes: customerNotes || null,
        user_id: (session?.user as any)?.id || "",
        status: "completed",
        created_at: now,
        updated_at: now,
        items: selectedProducts.map(p => ({
          product_id: (p.id || (p as any)._id || "").toString(),
          name: p.name,
          description: p.description,
          quantity: p.quantity,
          quantity_str: p.quantityInput || String(p.quantity),
          quantityType: p.quantityType || "prime",
          price: p.sell_price,
          discount: p.discount || 0,
          discountType: p.discountType || "value",
          unit_of_measurement: p.unit_of_measurement,
        }))
      };

      if (editOrderId) {
        const oldOrder = await db.orders.get(editOrderId);
        if (oldOrder) {
          orderData.created_at = oldOrder.created_at;
          orderData.status = oldOrder.status;
        }
        await db.orders.put(orderData);
      } else {
        await db.orders.add(orderData);
      }

      // 3. Update stock & missing UOM locally (optimistic)
      for (const p of selectedProducts) {
        const prodId = (p.id || (p as any)._id || "").toString();
        if (prodId) {
          const productDoc = await db.products.get(prodId);
          if (productDoc) {
            // Update stock if goods
            if (!p.type || p.type === "goods" || p.type === "good") {
              if (p.quantityType === "damaged") {
                const currentQty = parseFloat(productDoc.damaged_quantity?.toString() || "0");
                const newQty = Math.max(0, Math.round((currentQty - (Number(p.quantity) || 0)) * 100000) / 100000);
                await db.products.update(prodId, { damaged_quantity: newQty });
              } else {
                await adjustOfflineStock(prodId, -(Number(p.quantity) || 0));
              }
            }

            // If product originally had no UOM and user selected a UOM, update product permanently
            if (p.unit_of_measurement && (!productDoc.unit_of_measurement || productDoc.unit_of_measurement.trim() === "" || productDoc.unit_of_measurement === "-" || productDoc.unit_of_measurement === "none" || p.hadNoUomOriginally)) {
              await db.products.update(prodId, { unit_of_measurement: p.unit_of_measurement });
              await SyncEngine.queueOperation(
                "products",
                "PUT",
                `/api/products/${prodId}`,
                { unit_of_measurement: p.unit_of_measurement },
                prodId
              );
            }
          }
        }
      }

      // 4. Update balance locally (optimistic)
      const netAmount = finalTotal - (paymentDetails.noPaymentAtAll ? 0 : paymentDetails.paidAmount);
      if (netAmount !== 0) {
        await updateOfflinePartyBalance((selectedCustomer.id || (selectedCustomer as any)._id || "").toString(), netAmount);
      }

      // 5. Sync to server
      if (editOrderId) {
        await SyncEngine.queueOperation("orders", "PUT", `/api/orders/${editOrderId}`, payload, editOrderId);
      } else {
        await SyncEngine.queueOperation("orders", "POST", "/api/orders", payload, localOrderId);
      }

      setCreatedOrderShareData(shareData);

      // Show preview dialog directly, no intermediate success dialog
      setShowInvoicePreview(true);

      // We will reset the form and navigate when they close the preview
    } catch (error: any) {
      console.error("Error creating order:", error);
      setSaveError(error?.message || "An unexpected error occurred while saving the order.");
      setShowSaveErrorDialog(true);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3 bg-white p-3 rounded-lg shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/admin/sales/invoice`)}
            className="shrink-0 h-8 w-8 text-gray-500 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{editOrderId ? (t("editInvoice") || "Edit Invoice") : (t("title") || "Create Invoice")}</h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {editOrderId ? (t("editInvoiceDescription") || "Modify the details of this invoice") : (t("pageDescription") || "Customer ko Invoice banakar bhejein")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 md:flex items-center gap-1.5 sm:gap-2 w-full md:w-auto mt-2 md:mt-0">
          <Button 
            variant="outline" 
            className="w-full text-[10px] sm:text-xs h-8 px-1 sm:px-3 md:w-auto"
            onClick={handleClear}
          >
            <span className="text-gray-600">{tCommon("clear") || "Clear"}</span>
          </Button>
          <Button
            variant="outline"
            className="w-full text-[10px] sm:text-xs h-8 px-1 sm:px-3 md:w-auto text-primary border-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => setShowInvoicePreview(true)}
          >
            {t("preview") || "Preview"}
          </Button>
          <Button
            onClick={handleSaveOrder}
            disabled={isCreatingOrder}
            className="w-full text-[10px] sm:text-xs h-8 px-1 sm:px-3 md:w-auto bg-primary text-white hover:bg-primary/90"
          >
            {isCreatingOrder ? (
              <>
                <Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
                {t("creatingOrder") || tCommon("saving") || "Saving..."}
              </>
            ) : (
              editOrderId ? (t("updateInvoice") || "Update") : (t("saveInvoice") || "Save")
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
        {/* Main Content (Left Column) */}
        <div className="xl:col-span-3 space-y-2">
          {/* Section 1: Customer & Invoice Details */}
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">1</div>
              <CardTitle className="text-lg m-0">{t("invoiceDetails") || "Customer & Invoice Details"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <div className="space-y-3">
                  <Label htmlFor="customer" className="text-xs font-semibold text-gray-700">
                    {t("customer")} <span className="text-red-500">*</span>
                  </Label>
                  <div>
                      <PartyDropdown
                        value={selectedCustomer?.id ? String(selectedCustomer.id) : ""}
                        onValueChange={(val, customer) =>
                          handleSelectCustomer(val, customer as Customer | undefined)
                        }
                        placeholder={t("selectCustomer")}
                        className="w-full h-8 text-xs"
                        filterActiveOnly={true}
                        enableSearch={true}
                        searchPlaceholder={t("searchCustomer") || "Search customer..."}
                        autoSelectCash={true}
                      />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="invoice-no" className="text-xs font-semibold text-gray-700">
                    {t("invoiceNo")}
                  </Label>
                  <Input
                    id="invoice-no"
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="INV-001"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="sale-date" className="text-xs font-semibold text-gray-700">
                    {t("invoiceDate")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={selectedDate}
                    onChange={(val) => setSelectedDate(val)}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="due-date-section" className="text-xs font-semibold text-gray-700">
                    {t("dueDate")}
                  </Label>
                  <DatePicker
                    value={dueDate}
                    onChange={(val) => setDueDate(val)}
                    disabled={!addDueDate}
                    className="h-8 text-xs bg-white mb-3"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="add-due-date"
                      checked={addDueDate}
                      onChange={(e) => setAddDueDate(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label
                      htmlFor="add-due-date"
                      className="text-xs text-gray-600 font-normal cursor-pointer"
                    >
                      {t("addDueDate")}
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Items Add Karein */}
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">2</div>
              <CardTitle className="text-lg m-0">{t("addItems")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 p-0 md:p-3 md:pt-3">
              <ItemSelectTable
                selectedProducts={selectedProducts}
                handleQuantityChange={handleQuantityChange}
                handleQuantityBlur={handleQuantityBlur}
                handleQuantityTypeChange={handleQuantityTypeChange}
                handleSellPriceChange={handleSellPriceChange}
                handleSellPriceBlur={handleSellPriceBlur}
                handleDiscountChange={handleDiscountChange}
                handleDiscountTypeChange={handleDiscountTypeChange}
                handleUomChange={handleUomChange}
                handleRemoveProduct={handleRemoveProduct}
                handleSelectProduct={handleSelectProduct}
                handleRowProductChange={handleRowProductChange}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Section 3: Notes (Optional) */}
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">3</div>
              <CardTitle className="text-lg m-0">{t("notesOptional") || "Notes (Optional)"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <textarea
                placeholder={t("notesPlaceholder") || "Koi note likhein..."}
                className="w-full min-h-[60px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-3">{t("notePrintMessage") || "Yeh note invoice par print hoga"}</p>
            </CardContent>
          </Card>

          {/* Section 4: Total Aur Payment */}
          <Card className="shadow-sm border-0 ring-1 ring-gray-200">
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">4</div>
              <CardTitle className="text-lg m-0">{t("totalAurPayment") || "Total Aur Payment"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-xs text-gray-600 font-medium">{t("subTotal")}</span>
                  <span className="text-xs font-semibold text-gray-900">Rs. {Math.round(total)}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-xs text-gray-600 font-medium w-1/3">{t("discount")}</span>
                  <div className="flex gap-3 w-2/3">
                    <NumericInput
                      placeholder="0"
                      className="flex-1 h-8 text-xs"
                      value={overallDiscount || ""}
                      onChange={(e) => handleOverallDiscountInputChange(e.target.value)}
                    />
                    <Select
                      value={overallDiscountType}
                      onValueChange={(val) => handleOverallDiscountTypeChange(val as "value" | "percentage")}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs bg-white">
                        <SelectValue placeholder={t("pkr")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value">PKR</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-xs text-gray-600 font-medium w-1/3">{t("shippingCharges") || "Shipping / Charges"}</span>
                  <NumericInput
                    placeholder="0"
                    className="w-2/3 h-8 text-xs"
                    value={shippingCharges || ""}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      setShippingCharges(isNaN(value) ? 0 : Math.abs(value));
                    }}
                  />
                </div>

                <div className="flex justify-between items-center p-3 bg-blue-50/50 rounded-lg border border-blue-100 mt-3">
                  <span className="text-primary font-bold text-sm">{t("totalAmount") || "Total Amount"}</span>
                  <span className="text-primary font-bold text-base">Rs. {Math.floor(finalTotal)}</span>
                </div>

                <div className="space-y-2 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 font-medium w-1/3">{t("paymentMethod")}</span>
                    <div className="w-2/3">
                      <PaymentMethodDropdown
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                        placeholder="Cash in Hand"
                        defaultToCash={true}
                      />
                    </div>
                  </div>

                  {!isCashSale && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 font-medium w-1/3">{t("receivedAmount") || "Received Amount"}</span>
                      <NumericInput
                        value={paymentAmount === "" ? "" : paymentAmount}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Number(e.target.value);
                          if (val !== "" && val > Math.floor(finalTotal)) {
                            setSaveError(t("paymentGreaterError") || "Payment cannot be greater than Total Amount");
                            setShowSaveErrorDialog(true);
                            setPaymentAmount(Math.floor(finalTotal));
                          } else {
                            setPaymentAmount(val);
                          }
                        }}
                        placeholder="0"
                        className="w-2/3 h-8 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {!isCashSale && paymentAmount !== "" && paymentAmount > 0 && (
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                      <span className="text-xs text-gray-600 font-medium">{t("balance") || "Balance"}</span>
                      <span className="text-xs font-semibold text-gray-900">
                        Rs. {Math.floor(finalTotal) - Number(paymentAmount)}
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
              <CardTitle className="text-lg">{t("invoiceSummary") || "Invoice Summary"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("items")}</span>
                  <span className="font-medium text-gray-900">{selectedProducts.length}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("totalQuantity") || "Total Quantity"}</span>
                  <span className="font-medium text-gray-900">
                    {selectedProducts.reduce((sum, p) => sum + (p.quantity || 1), 0)}
                  </span>
                </div>
                
                <div className="h-px bg-gray-100 my-4"></div>
                
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("subTotal")}</span>
                  <span className="font-medium text-gray-900">Rs. {Math.round(total)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("discount")}</span>
                  <span className="font-medium text-gray-900">Rs. {Math.round(overallDiscountAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t("shippingCharges") || "Shipping / Charges"}</span>
                  <span className="font-medium text-gray-900">Rs. {Math.round(shippingChargesNum)}</span>
                </div>
                
                <div className="h-px bg-gray-100 my-4"></div>
                



                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-900">{t("totalAmount") || "Total Amount"}</span>
                  <span className="font-bold text-lg text-primary">Rs. {Math.floor(finalTotal)}</span>
                </div>

                {!isCashSale && paymentAmount !== "" && paymentAmount > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-gray-600 mb-2">
                      <span>{t("receivedAmount") || "Received Amount"}</span>
                      <span className="font-medium text-gray-900">Rs. {Number(paymentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-primary font-bold ">
                      <span>{t("balance") || "Balance"}</span>
                      <span>Rs. {Math.floor(finalTotal) - Number(paymentAmount)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3 mb-3 text-primary font-semibold">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 7v1"/><path d="M12 12v1"/><path d="M12 17v1"/><path d="M4 12h1"/><path d="M9 12h1"/><path d="M14 12h1"/><path d="M19 12h1"/><path d="M6 7l1 1"/><path d="M9 10l1 1"/><path d="M14 15l1 1"/><path d="M17 18l1 1"/><path d="M6 17l1-1"/><path d="M9 14l1-1"/><path d="M14 9l1-1"/><path d="M17 6l1-1"/></svg>
                  {t("asaanTip") || "Asaan Tip"}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {t("asaanTipText") || "Pehle Customer select karein, phir items add karein aur Save Invoice par click karein."}
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
        title={t("error")}
        message={saveError}
      />

      {/* Overstock Warning Dialog */}
      <ConfirmDialog
        open={showOverstockDialog}
        onOpenChange={setShowOverstockDialog}
        title={t("overstockWarningTitle")}
        description={
          <div className="space-y-2">
            <ul className="list-disc list-inside space-y-2 text-foreground">
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

      {createdOrderShareData && (
        <div className="hidden" aria-hidden>
          <InvoicePreview
            ref={invoiceShareRef}
            invoiceNo={createdOrderShareData.invoiceNo}
            customer={{
              name: createdOrderShareData.customerName,
              email: createdOrderShareData.customerEmail,
              phone: createdOrderShareData.phone,
            }}
            saleDate={createdOrderShareData.saleDate}
            dueDate={createdOrderShareData.dueDate}
            products={createdOrderShareData.products}
            subtotal={createdOrderShareData.subtotal}
            charges={createdOrderShareData.charges}
            overallDiscount={createdOrderShareData.overallDiscount}
            shippingCharges={createdOrderShareData.shippingCharges}
            total={createdOrderShareData.total}
            noPaymentAtAll={createdOrderShareData.noPaymentAtAll}
            paidAmount={createdOrderShareData.paidAmount}
            paidDate={createdOrderShareData.paidDate}
            companyName={createdOrderShareData.companyName}
            customerNotes={createdOrderShareData.customerNotes}
          />
        </div>
      )}

      <InvoicePreviewDialog
        open={showInvoicePreview}
        onOpenChange={(isOpen) => {
          setShowInvoicePreview(isOpen);
          if (!isOpen && createdOrderShareData) {
            setSelectedProducts([]);
            setSelectedCustomer(null);
            setInvoiceNo("");
            setSelectedDate(getTodayDateString());
            setAddDueDate(false);
            setDueDate(getTodayDateString());
            setCharges([]);
            setShowAddCharge(false);
            setCreatedOrderShareData(null);
            router.push(`/${locale}/admin/sales/invoice`);
          }
        }}
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
          quantity_str: p.quantityInput || String(p.quantity),
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
        onWhatsApp={handleSendInvoicePdfOnWhatsApp}
        disableWhatsApp={!getWhatsAppLink()}
        isSendingWhatsApp={isSendingWhatsApp}
        initialPayment={
          isCashSale 
          ? {
              method: paymentMethod || "cash",
              paid_amount: Math.floor(finalTotal),
              paid_date: new Date().toISOString(),
              no_payment_at_all: false,
            }
          : {
              method: paymentMethod,
              paid_amount: paymentAmount === "" ? 0 : Number(paymentAmount),
              paid_date: new Date().toISOString(),
              no_payment_at_all: paymentAmount === "" || Number(paymentAmount) === 0,
            }
        }
      />
    </div>
  );
}
