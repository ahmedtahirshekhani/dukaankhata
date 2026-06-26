'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Edit } from 'lucide-react';
import { useOfflinePaymentMethods } from '@/lib/hooks/useOfflineData';
import { db } from '@/lib/db/offline-db';
import { SyncEngine } from '@/lib/sync/sync-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface PaymentMethodItem {
  id: string;
  bankName: string;
  bankDetails: string;
  createdAt?: string;
  updatedAt?: string;
}

const INPUT_CLASS =
  'flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

interface PaymentMethodSectionProps {
  locale: string;
}

export function PaymentMethodSection({ locale }: PaymentMethodSectionProps) {
  const t = useTranslations('configurationPage');
  const tCommon = useTranslations('common');

  const offlineMethods = useOfflinePaymentMethods();
  const isLoadingMethods = offlineMethods === undefined;
  
  const list: PaymentMethodItem[] = (offlineMethods || []).map((item: any) => ({
    id: item.id || item._id,
    bankName: item.bankName || item.name || item.bank_name || '',
    bankDetails: item.bankDetails || item.bank_details || '',
    createdAt: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at
  }));

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const [bankName, setBankName] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [viewItem, setViewItem] = useState<PaymentMethodItem | null>(null);

  const baseUrl = `/${locale}/api/configuration/payment-method`;

  const showMessage = useCallback((text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
    setTimeout(() => {
      setMessage('');
      setMessageError(false);
    }, 2500);
  }, []);

  const resetForm = useCallback(() => {
    setBankName('');
    setBankDetails('');
    setEditingId(null);
  }, []);

  const handleSave = async () => {
    const name = bankName.trim();
    if (!name) {
      showMessage(t('paymentMethodBankNameRequired'), true);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        bankName: name,
        bankDetails: bankDetails.trim(),
      };

      if (editingId) {
        const existing = await db.payment_methods.get(editingId);
        if (existing) {
          await db.payment_methods.put({ ...existing, ...payload });
        } else {
          await db.payment_methods.put({ id: editingId, ...payload });
        }
        await SyncEngine.queueOperation("payment_methods", "PUT", `${baseUrl}/${editingId}`, payload);
        showMessage(t('paymentMethodUpdated'));
      } else {
        const existing = offlineMethods?.find(
          (m: any) =>
            (m.bankName || m.name || m.bank_name)?.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          throw new Error(t('paymentMethodBankNameDuplicate'));
        }

        const methodId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}`;
        const localMethod = {
          id: methodId,
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.payment_methods.add(localMethod as any);
        await SyncEngine.queueOperation("payment_methods", "POST", baseUrl, payload, methodId);
        showMessage(t('paymentMethodSaved'));
      }
      resetForm();
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : t('failedToSave'), true);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: PaymentMethodItem) => {
    setBankName(item.bankName);
    setBankDetails(item.bankDetails);
    setEditingId(item.id);
  };

  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('paymentMethodTitle')}</CardTitle>
          <CardDescription>{t('paymentMethodDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div
              className={cn(
                'p-3 rounded text-sm',
                messageError
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-blue-50 border border-blue-200 text-blue-700'
              )}
            >
              {message}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="payment-method-bank-name">{t('paymentMethodBankName')}</Label>
            <Input
              id="payment-method-bank-name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder={t('paymentMethodBankNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-method-bank-details">{t('paymentMethodBankDetails')}</Label>
            <textarea
              id="payment-method-bank-details"
              value={bankDetails}
              onChange={(e) => setBankDetails(e.target.value)}
              placeholder={t('paymentMethodBankDetailsPlaceholder')}
              rows={4}
              className={cn(INPUT_CLASS, 'min-h-[80px] resize-y')}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : editingId ? tCommon('save') : t('paymentMethodSave')}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                {tCommon('cancel')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">{t('paymentMethodListTitle')}</h3>
        {isLoadingMethods ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('paymentMethodNoItems')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((item) => (
              <Card key={item.id} className="flex flex-col relative">
                <CardHeader className="pb-2 pr-24">
                  <div className="flex items-start justify-between gap-2 min-h-[2.5rem]">
                    <CardTitle className="text-base font-semibold break-words min-w-0 flex-1 leading-snug">
                      {item.bankName}
                    </CardTitle>
                    <div className="absolute top-4 right-4 flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewItem(item)}
                        title={t('paymentMethodView')}
                        type="button"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(item)}
                        title={tCommon('edit')}
                        type="button"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.bankDetails || '—'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View dialog */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewItem?.bankName ?? ''}</DialogTitle>
            <DialogDescription>{t('paymentMethodViewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {viewItem?.bankDetails || '—'}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>
              {tCommon('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
