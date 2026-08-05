import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ImportSummary {
  parties: number;
  expense_categories: number;
  products: number;
  sales: number;
  purchases: number;
  payments_in: number;
  payments_out: number;
  expenses: number;
  skipped: number;
}

const SUMMARY_LABELS: { key: keyof ImportSummary; label: string }[] = [
  { key: 'parties', label: 'Parties' },
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'payments_in', label: 'Payments In' },
  { key: 'payments_out', label: 'Payments Out' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'expense_categories', label: 'Expense Categories' },
  { key: 'skipped', label: 'Skipped' },
];

export default function BMBKImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setProgress(5);
    setMessage('Uploading file...');
    setSummary(null);

    try {
      const timer = setInterval(() => setProgress(p => Math.min(p + 8, 90)), 500);
      const res = await fetch('/api/import/bmbk', { method: 'POST', body: formData });
      clearInterval(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setProgress(100);
      setMessage('Import complete');
      setSummary(data.summary);
      setDialogOpen(true);
      toast.success('BMBK data imported successfully');
    } catch (err: any) {
      setProgress(0);
      setMessage(err.message);
      toast.error(err.message || 'Import failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const total = summary
    ? (summary.parties + summary.products + summary.sales + summary.purchases +
       summary.payments_in + summary.payments_out + summary.expenses)
    : 0;

  return (
    <>
      <Card className='rounded-2xl shadow-sm border'>
        <CardContent className='p-4 space-y-4'>
          <div className='flex items-center gap-3'>
            <FileSpreadsheet className='h-5 w-5' />
            <div>
              <h3 className='font-semibold'>Import BMBK Database</h3>
              <p className='text-sm text-muted-foreground'>Upload a .BMBK SQLite file and import accounts, items, and vouchers.</p>
            </div>
          </div>

          <input ref={inputRef} type='file' accept='.BMBK,.bmbk,.sqlite,.db' className='hidden' onChange={onFileChange} />

          <Button onClick={pickFile} disabled={loading} className='w-full rounded-2xl'>
            {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Upload className='mr-2 h-4 w-4' />}
            {loading ? 'Importing...' : 'Choose BMBK File'}
          </Button>

          {(loading || progress > 0) && (
            <div className='space-y-2'>
              <Progress value={progress} />
              <div className='text-sm text-muted-foreground flex items-center gap-2'>
                {progress === 100
                  ? <CheckCircle2 className='h-4 w-4 text-green-500' />
                  : loading
                    ? <Loader2 className='h-4 w-4 animate-spin' />
                    : <AlertCircle className='h-4 w-4' />}
                <span>{message}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-green-500' />
              Import Complete
            </DialogTitle>
          </DialogHeader>

          {summary && (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Successfully imported <span className='font-semibold text-foreground'>{total}</span> records across all modules.
              </p>

              <div className='rounded-lg border divide-y text-sm'>
                {SUMMARY_LABELS.map(({ key, label }) => {
                  const count = summary[key];
                  if (count === 0 && key !== 'skipped') return null;
                  return (
                    <div key={key} className='flex justify-between items-center px-3 py-2'>
                      <span className='text-muted-foreground'>{label}</span>
                      <span className={`font-semibold tabular-nums ${key === 'skipped' ? 'text-amber-500' : 'text-foreground'}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className='flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800'>
                <RefreshCw className='h-4 w-4 mt-0.5 shrink-0' />
                <span>Please refresh the page to see the imported data reflected across the app.</span>
              </div>
            </div>
          )}

          <DialogFooter className='flex-col sm:flex-col gap-2'>
            <Button className='w-full rounded-xl' onClick={() => window.location.reload()}>
              <RefreshCw className='mr-2 h-4 w-4' />
              Refresh Page
            </Button>
            <Button variant='outline' className='w-full rounded-xl' onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}