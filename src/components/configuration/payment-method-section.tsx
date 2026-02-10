'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, Edit, Trash2 } from 'lucide-react';
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

  const [list, setList] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);

  const [bankName, setBankName] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [viewItem, setViewItem] = useState<PaymentMethodItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PaymentMethodItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const baseUrl = `/${locale}/api/configuration/payment-method`;

  const showMessage = useCallback((text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
    setTimeout(() => {
      setMessage('');
      setMessageError(false);
    }, 2500);
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(baseUrl);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setList(data);
      }
    } catch (err) {
      console.error('Failed to load payment methods', err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

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
      if (editingId) {
        const res = await fetch(`${baseUrl}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankName: name, bankDetails: bankDetails.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to update');
        }
        setList((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  bankName: data.bankName ?? name,
                  bankDetails: data.bankDetails ?? bankDetails.trim(),
                }
              : item
          )
        );
        showMessage(t('paymentMethodUpdated'));
      } else {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankName: name, bankDetails: bankDetails.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to save');
        }
        setList((prev) => [
          {
            id: data.id,
            bankName: data.bankName ?? name,
            bankDetails: data.bankDetails ?? bankDetails.trim(),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
          ...prev,
        ]);
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

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/${deleteItem.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || 'Failed to delete');
      }
      setList((prev) => prev.filter((item) => item.id !== deleteItem.id));
      showMessage(t('paymentMethodDeleted'));
      setDeleteItem(null);
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : t('failedToSave'), true);
    } finally {
      setDeleting(false);
    }
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
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('paymentMethodNoItems')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((item) => (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate" title={item.bankName}>
                      {item.bankName}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteItem(item)}
                        title={tCommon('delete')}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('paymentMethodDeleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('paymentMethodDeleteDescription', { name: deleteItem?.bankName ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleting}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? t('saving') : tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
