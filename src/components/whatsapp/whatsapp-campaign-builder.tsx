"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Users,
  Search,
  Sparkles,
  ShieldCheck,
  Send,
  Loader2,
  Clock,
  Shuffle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from "lucide-react";

interface CustomerItem {
  id: string;
  name: string;
  company_name: string;
  phone: string;
  cleaned_phone: string;
  has_valid_phone: boolean;
  balance: number;
  last_marketing_sent_at: string | null;
  marketing_messages_sent_count: number;
}

interface MessageVariant {
  id: string;
  text: string;
}

interface Props {
  locale: string;
  onCampaignCreated: (campaignId: string) => void;
  onCancel?: () => void;
}

const DEFAULT_VARIANTS: MessageVariant[] = [
  {
    id: "var_1",
    text: "Assalam-o-Alaikum {customer_name}! {shop_name} ki taraf se shandar deals aur offers. Mazeed tafseelat ke liye hamari dukaan visit karein ya rabta karein. Shukriya!",
  },
  {
    id: "var_2",
    text: "Pyare {customer_name} bhai, umeed hai aap khairiyat se honge. Hamare paas {shop_name} par naya stock aur special discounts dastiyab hain. Zaroor visit karein!",
  },
  {
    id: "var_3",
    text: "Salam {customer_name}! {shop_name} se aap ke liye special discount voucher. Tashreef layen aur bachat ka faida uthayen.",
  },
];

export function WhatsappCampaignBuilder({ locale, onCampaignCreated, onCancel }: Props) {
  const [campaignName, setCampaignName] = useState("");
  const [variants, setVariants] = useState<MessageVariant[]>(DEFAULT_VARIANTS);
  const [cooldownSeconds, setCooldownSeconds] = useState(20);
  const [cooldownJitter, setCooldownJitter] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [batchCooldownSeconds, setBatchCooldownSeconds] = useState(180);

  // Customers state
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerFilter, setCustomerFilter] = useState<"all" | "never_sent" | "with_balance" | "zero_balance">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  const [neverSentCount, setNeverSentCount] = useState(0);
  const [alreadySentCount, setAlreadySentCount] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch customers
  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const url = `/${locale}/api/whatsapp/campaigns/customers?filter=${customerFilter}&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setNeverSentCount(data.neverSentCount || 0);
        setAlreadySentCount(data.alreadySentCount || 0);
      }
    } catch (err) {
      console.error("Failed to load customers:", err);
      toast.error("Failed to load customers list");
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [locale, customerFilter]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchCustomers();
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Add / remove variant
  const handleAddVariant = () => {
    const newId = `var_${Date.now()}`;
    setVariants((prev) => [
      ...prev,
      {
        id: newId,
        text: `Assalam-o-Alaikum {customer_name}! Shop {shop_name} ki taraf se new offer...`,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.error("At least one message variant is required");
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateVariantText = (index: number, text: string) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text };
      return updated;
    });
  };

  const insertTagIntoVariant = (index: number, tag: string) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text: `${updated[index].text} ${tag}` };
      return updated;
    });
  };

  // Customer selection helpers
  const handleToggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const validVisibleIds = customers.filter((c) => c.has_valid_phone).map((c) => c.id);
    const allSelected = validVisibleIds.every((id) => selectedCustomerIds.has(id));

    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        validVisibleIds.forEach((id) => next.delete(id));
      } else {
        validVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllNeverSent = () => {
    const neverSentIds = customers
      .filter((c) => !c.last_marketing_sent_at && c.has_valid_phone)
      .map((c) => c.id);

    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      neverSentIds.forEach((id) => next.add(id));
      return next;
    });
    toast.success(`Selected ${neverSentIds.length} never-contacted customers!`);
  };

  const handleClearSelection = () => {
    setSelectedCustomerIds(new Set());
  };

  // Submit campaign
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error("Please provide a name for this campaign");
      return;
    }

    if (variants.length === 0 || variants.some((v) => !v.text.trim())) {
      toast.error("Please make sure all message variants have text content");
      return;
    }

    if (selectedCustomerIds.size === 0) {
      toast.error("Please select at least one customer to message");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName.trim(),
          variants,
          cooldown_seconds: cooldownSeconds,
          cooldown_jitter: cooldownJitter,
          batch_size: batchSize,
          batch_cooldown_seconds: batchCooldownSeconds,
          recipient_ids: Array.from(selectedCustomerIds),
        }),
      });

      const data = await res.json();
      if (res.ok && data.campaignId) {
        toast.success("Campaign created successfully!");
        onCampaignCreated(data.campaignId);
      } else {
        toast.error(data.error || "Failed to create campaign");
      }
    } catch (err: any) {
      toast.error("Error creating campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllVisibleSelected = useMemo(() => {
    const validVisibleIds = customers.filter((c) => c.has_valid_phone).map((c) => c.id);
    return validVisibleIds.length > 0 && validVisibleIds.every((id) => selectedCustomerIds.has(id));
  }, [customers, selectedCustomerIds]);

  return (
    <div className="space-y-6">
      {/* Campaign Details Header */}
      <Card className="shadow-sm border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Create WhatsApp Marketing Campaign
              </CardTitle>
              <CardDescription className="mt-1">
                Configure your message variants, recipient list with &quot;never sent on top&quot; prioritization, and anti-ban cooldown intervals.
              </CardDescription>
            </div>
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-md">
            <Label htmlFor="campName" className="font-semibold text-sm">
              Campaign Name *
            </Label>
            <Input
              id="campName"
              placeholder="e.g. Eid Mubarak Special Offer / Winter Collection"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* STEP 1: Message Variants (Spintax) */}
      <Card className="shadow-sm border-purple-500/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shuffle className="w-5 h-5 text-purple-600" />
                Message Variants (Anti-Ban Random Rotation)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                The system randomly rotates these variants for each recipient to keep message hashes distinct and prevent WhatsApp spam detection.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
              className="text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border">
            <span className="font-semibold text-muted-foreground mr-1">Available Tags:</span>
            <Button variant="secondary" size="sm" onClick={() => insertTagIntoVariant(0, "{customer_name}")} className="h-6 text-xs font-mono px-2">
              + {"{customer_name}"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => insertTagIntoVariant(0, "{shop_name}")} className="h-6 text-xs font-mono px-2">
              + {"{shop_name}"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => insertTagIntoVariant(0, "{balance}")} className="h-6 text-xs font-mono px-2">
              + {"{balance}"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => insertTagIntoVariant(0, "{phone}")} className="h-6 text-xs font-mono px-2">
              + {"{phone}"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => insertTagIntoVariant(0, "{date}")} className="h-6 text-xs font-mono px-2">
              + {"{date}"}
            </Button>
          </div>

          <div className="space-y-4">
            {variants.map((variant, index) => {
              const probabilityPercent = Math.round(100 / variants.length);
              return (
                <div key={variant.id} className="p-4 rounded-xl border bg-card/60 space-y-3 relative group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center justify-center">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-sm font-semibold">Variant {String.fromCharCode(65 + index)}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                        ~{probabilityPercent}% distribution
                      </span>
                    </div>
                    {variants.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveVariant(index)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="Remove Variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <Textarea
                    rows={3}
                    value={variant.text}
                    onChange={(e) => handleUpdateVariantText(index, e.target.value)}
                    placeholder={`Write text for Variant ${String.fromCharCode(65 + index)}...`}
                    className="font-sans text-sm resize-y"
                  />

                  {/* Sample Live Preview */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground mr-1">Preview:</span>
                    {variant.text
                      .replace(/\{customer_name\}/gi, "Muhammad Ali")
                      .replace(/\{shop_name\}/gi, "Hamari Dukaan")
                      .replace(/\{balance\}/gi, "Rs. 0")
                      .replace(/\{phone\}/gi, "03001234567")
                      .replace(/\{date\}/gi, "Today")}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* STEP 2: Anti-Ban & Cooldown Parameters */}
      <Card className="shadow-sm border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Anti-Ban Cooldown & Batching Rules
          </CardTitle>
          <CardDescription className="text-xs">
            Fine-tune delays to simulate realistic human messaging intervals and safeguard your phone number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setting 1: Per-message cooldown */}
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cooldownSec" className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Per-Message Cooldown
                </Label>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {cooldownSeconds}s delay
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pause interval between each individual message (recommended: 15s to 30s).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  id="cooldownSec"
                  type="number"
                  min={10}
                  max={90}
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(Math.max(10, Math.min(90, Number(e.target.value) || 20)))}
                  className="w-24 text-center font-mono"
                />
                <span className="text-xs text-muted-foreground">seconds</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t mt-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer" htmlFor="jitterToggle">
                    Random Human Jitter
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Adds +2 to +7s random variation to avoid algorithmic rhythm detection.
                  </p>
                </div>
                <Switch
                  id="jitterToggle"
                  checked={cooldownJitter}
                  onCheckedChange={setCooldownJitter}
                />
              </div>
            </div>

            {/* Setting 2: Batch pause after every 10 messages */}
            <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="batchCooldownSec" className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  10-Message Batch Cooldown
                </Label>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  Pause after {batchSize} msgs
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatic cooling break after every 10 messages to reset WhatsApp rate limits.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Math.max(5, Math.min(30, Number(e.target.value) || 10)))}
                    className="w-20 text-center font-mono"
                  />
                  <span className="text-xs text-muted-foreground">msgs</span>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="batchCooldownSec"
                    type="number"
                    min={60}
                    max={600}
                    value={batchCooldownSeconds}
                    onChange={(e) => setBatchCooldownSeconds(Math.max(60, Math.min(600, Number(e.target.value) || 180)))}
                    className="w-24 text-center font-mono"
                  />
                  <span className="text-xs text-muted-foreground">seconds ({Math.round(batchCooldownSeconds / 60)} min)</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
                ✓ Guaranteed requirement: Campaign pauses 3 minutes after each 10 messages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 3: Customer Selector with "Never Sent on Top" */}
      <Card className="shadow-sm border-primary/20">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Select Recipients (Never Sent on Top)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Customers who have never received a marketing message are sorted strictly on top to ensure fresh reach.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllNeverSent}
                className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Select All Never Sent ({neverSentCount})
              </Button>
              {selectedCustomerIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="text-xs text-muted-foreground"
                >
                  Clear ({selectedCustomerIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
              <Button
                variant={customerFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCustomerFilter("all")}
                className="text-xs h-8"
              >
                All ({customers.length})
              </Button>
              <Button
                variant={customerFilter === "never_sent" ? "default" : "outline"}
                size="sm"
                onClick={() => setCustomerFilter("never_sent")}
                className="text-xs h-8 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
              >
                Never Contacted ({neverSentCount})
              </Button>
              <Button
                variant={customerFilter === "with_balance" ? "default" : "outline"}
                size="sm"
                onClick={() => setCustomerFilter("with_balance")}
                className="text-xs h-8"
              >
                With Udhaar
              </Button>
              <Button
                variant={customerFilter === "zero_balance" ? "default" : "outline"}
                size="sm"
                onClick={() => setCustomerFilter("zero_balance")}
                className="text-xs h-8"
              >
                Zero Balance
              </Button>
            </div>
          </div>

          {/* Customers Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={isAllVisibleSelected}
                      onCheckedChange={handleSelectAllVisible}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Customer</TableHead>
                  <TableHead className="text-xs font-semibold">Phone</TableHead>
                  <TableHead className="text-xs font-semibold">Balance</TableHead>
                  <TableHead className="text-xs font-semibold">Last Marketing Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingCustomers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-muted-foreground mt-2">Loading customers...</p>
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No matching customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((cust) => {
                    const isSelected = selectedCustomerIds.has(cust.id);
                    const isNeverSent = !cust.last_marketing_sent_at;

                    return (
                      <TableRow
                        key={cust.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5" : isNeverSent ? "bg-emerald-500/[0.02]" : ""
                        }`}
                        onClick={() => cust.has_valid_phone && handleToggleCustomer(cust.id)}
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            disabled={!cust.has_valid_phone}
                            onCheckedChange={() => handleToggleCustomer(cust.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-foreground">{cust.name}</div>
                          {cust.company_name && (
                            <div className="text-[11px] text-muted-foreground">{cust.company_name}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {cust.has_valid_phone ? (
                            <span>{cust.phone}</span>
                          ) : (
                            <span className="text-destructive text-[11px] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Missing / Invalid
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {cust.balance > 0 ? (
                            <span className="text-amber-600 font-semibold">Rs. {cust.balance.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">Rs. 0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isNeverSent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <Sparkles className="w-3 h-3" />
                              Never Sent (Top)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {new Intl.DateTimeFormat("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }).format(new Date(cust.last_marketing_sent_at!))}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Selection Status Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border bg-muted/30">
            <div className="text-xs text-foreground font-medium flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                <strong>{selectedCustomerIds.size}</strong> customer(s) selected for this campaign
              </span>
            </div>

            <Button
              onClick={handleCreateCampaign}
              disabled={isSubmitting || selectedCustomerIds.size === 0 || !campaignName.trim()}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 px-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Create &amp; Launch Campaign
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
