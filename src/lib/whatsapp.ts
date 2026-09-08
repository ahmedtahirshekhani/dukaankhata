import { toast } from "sonner";

export interface WhatsAppCustomer {
  name: string;
  phone?: string;
  balance?: number;
}

export function formatWhatsAppPhone(phone: string): string {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  if (!cleanPhone) return "";
  if (cleanPhone.startsWith("0")) return `92${cleanPhone.slice(1)}`;
  if (cleanPhone.startsWith("92")) return cleanPhone;
  if (cleanPhone.length === 10) return `92${cleanPhone}`;
  return cleanPhone;
}

export function sendWhatsAppReminder(
  customer: WhatsAppCustomer,
  options?: {
    locale?: string;
    currencySymbol?: string;
    customMessage?: string;
    onError?: (msg: string) => void;
  }
): boolean {
  const cleanPhone = (customer.phone || "").replace(/\D/g, "");
  const locale = options?.locale || "en";

  if (!cleanPhone || cleanPhone.length < 5) {
    const baseMsg = "No WhatsApp number available for this customer.";
    const instructMsg =
      locale === "ur"
        ? "\n\nبراہ کرم اس گاہک کا فون نمبر درج کریں۔ آپ Customers سیکشن میں جا کر تبدیل کریں (Edit) بٹن پر کلک کر کے نمبر شامل کر سکتے ہیں۔"
        : locale === "ru"
        ? "\n\nIs customer ka phone number add karain. Aap Customers section mein Edit button par click kar ke number add kar sakte hain."
        : "\n\nPlease add a phone number for this customer. You can navigate to the Customers section and edit the customer to add their number.";

    const fullError = baseMsg + instructMsg;
    if (options?.onError) {
      options.onError(fullError);
    } else {
      toast.error(fullError, { duration: 5000 });
    }
    return false;
  }

  const whatsappPhone = formatWhatsAppPhone(cleanPhone);
  const currency = options?.currencySymbol || "Rs.";
  const roundedBalance = Math.round(customer.balance || 0);

  let message = options?.customMessage || "";
  if (!message) {
    if (locale === "ur") {
      message = `السلام علیکم ${customer.name}،\n\nبراہ کرم اپنا بقایا بیلنس ${currency} ${roundedBalance} بھیج دیں۔\n\nشکریہ!`;
    } else if (locale === "ru") {
      message = `Assalam o Alaikum ${customer.name},\n\nFriendly reminder: Please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nShukriya!`;
    } else {
      message = `Dear ${customer.name},\n\nThis is a friendly reminder to please clear your outstanding balance of ${customer.balance !== undefined ? currency + " " + roundedBalance : ""}.\n\nThank you!`;
    }
  }

  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  return true;
}

