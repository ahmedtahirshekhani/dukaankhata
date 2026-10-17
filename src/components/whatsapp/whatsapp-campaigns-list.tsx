"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  Sparkles,
  Plus,
  Play,
  RotateCcw,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  Calendar,
} from "lucide-react";

interface CampaignItem {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  variants_count: number;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  last_run_at?: string;
}

interface Props {
  locale: string;
  onCreateNew: () => void;
  onOpenCampaign: (campaignId: string) => void;
}

export function WhatsappCampaignsList({ locale, onCreateNew, onOpenCampaign }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      toast.error("Failed to load campaigns");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [locale]);

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/${locale}/api/whatsapp/campaigns/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Campaign deleted");
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error("Failed to delete campaign");
      }
    } catch (err) {
      toast.error("Error deleting campaign");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              WhatsApp Marketing Campaigns
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Broadcast personalized marketing offers to your customers with built-in anti-ban protection.
            </CardDescription>
          </div>
          <Button
            onClick={onCreateNew}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground mt-2">Loading marketing campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-16 text-center border rounded-xl border-dashed bg-muted/20">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 mx-auto flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold">No Marketing Campaigns Yet</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Create your first WhatsApp marketing campaign to reach your customers with special discounts and new arrivals.
            </p>
            <Button
              onClick={onCreateNew}
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Campaign
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Campaign Name</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Recipients</TableHead>
                  <TableHead className="text-xs font-semibold">Delivery Progress</TableHead>
                  <TableHead className="text-xs font-semibold">Date Created</TableHead>
                  <TableHead className="text-right text-xs font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((camp) => {
                  const percent =
                    camp.total_recipients > 0
                      ? Math.round(((camp.sent_count + camp.failed_count) / camp.total_recipients) * 100)
                      : 0;

                  return (
                    <TableRow
                      key={camp.id}
                      onClick={() => onOpenCampaign(camp.id)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground">{camp.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {camp.variants_count} message variant(s)
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            camp.status === "completed"
                              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                              : camp.status === "running"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse"
                              : camp.status === "paused"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {camp.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          {camp.total_recipients}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="w-32 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-muted-foreground">
                              {camp.sent_count}/{camp.total_recipients}
                            </span>
                            <span className="font-semibold text-foreground">{percent}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(camp.created_at))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenCampaign(camp.id)}
                            className="text-xs h-7 px-2.5"
                          >
                            {camp.status === "completed" ? "View Results" : "Open / Run"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteCampaign(camp.id, e)}
                            disabled={deletingId === camp.id}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title="Delete Campaign"
                          >
                            {deletingId === camp.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
