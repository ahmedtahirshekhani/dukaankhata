"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface WaitlistFormData {
  name: string;
  whatsappNumber: string;
  companyName: string;
  companyAddress: string;
  category: string;
  description: string;
}

const CATEGORIES = [
  "Retail Store",
  "Restaurant",
  "Bakery",
  "Pharmacy",
  "Supermarket",
  "Boutique",
  "Hardware Store",
  "Other",
];

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [formData, setFormData] = useState<WaitlistFormData>({
    name: "",
    whatsappNumber: "",
    companyName: "",
    companyAddress: "",
    category: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      category: value,
      description: value !== "Other" ? "" : prev.description,
    }));
  };

  const handleWhatsAppNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, "");
    
    // Limit to 11 digits
    const limitedValue = numericValue.slice(0, 11);
    
    setFormData((prev) => ({
      ...prev,
      whatsappNumber: limitedValue,
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return false;
    }
    if (!formData.whatsappNumber.trim()) {
      setError("WhatsApp number is required");
      return false;
    }
    
    // Validate Pakistani mobile number format (11 digits starting with 03)
    const phoneRegex = /^03\d{9}$/;
    if (!phoneRegex.test(formData.whatsappNumber)) {
      setError("Please enter a valid Pakistani mobile number (e.g., 03001234567)");
      return false;
    }
    if (!formData.category) {
      setError("Please select a category");
      return false;
    }
    if (formData.category === "Other" && !formData.description.trim()) {
      setError("Description is required for 'Other' category");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Send data to API endpoint
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle API errors
        setError(data.error || "Failed to join waitlist. Please try again.");
        return;
      }

      // Success - show confirmation
      setSuccess(true);
      setTimeout(() => {
        setFormData({
          name: "",
          whatsappNumber: "",
          companyName: "",
          companyAddress: "",
          category: "",
          description: "",
        });
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      console.error("Waitlist submission error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading && !success) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Join Our Waitlist</DialogTitle>
          <DialogDescription>
            Be the first to know when DukaanKhata launches. Enter your details
            below.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8">
            <div className="mb-4 text-5xl">✓</div>
            <h3 className="text-lg font-semibold text-green-600">
              Thanks for joining!
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              We'll contact you on WhatsApp soon with exclusive launch details.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="name"
                placeholder="Your full name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>

            {/* WhatsApp Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="whatsappNumber"
                placeholder="03001234567"
                value={formData.whatsappNumber}
                onChange={handleWhatsAppNumberChange}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter 11-digit Pakistani mobile number (e.g., 03001234567)
              </p>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Company Name{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="text"
                name="companyName"
                placeholder="Your business name"
                value={formData.companyName}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>

            {/* Company Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Company Address{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="text"
                name="companyAddress"
                placeholder="Business address"
                value={formData.companyAddress}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Which category?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Select
                value={formData.category}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger disabled={loading}>
                  <SelectValue placeholder="Select your business category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description (appears when "Other" is selected) */}
            {formData.category === "Other" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-medium text-foreground">
                  Tell us about your business{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  placeholder="Describe your business type..."
                  value={formData.description}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              We respect your privacy. No spam, we promise!
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
