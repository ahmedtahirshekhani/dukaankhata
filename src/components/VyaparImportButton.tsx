import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VyaparImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const pickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true); setProgress(5); setMessage('Uploading file...');
    try {
      const timer = setInterval(() => setProgress(p => Math.min(p + 8, 90)), 500);
      const res = await fetch('/api/import/vyapar', { method: 'POST', body: formData });
      clearInterval(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setProgress(100);
      setMessage(`Imported: ${data.summary?.totalRecords || 0} records`);
      toast.success('Vyapar data imported successfully');
    } catch (err:any) {
      setProgress(0);
      setMessage(err.message);
      toast.error(err.message || 'Import failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <Card className='rounded-2xl shadow-sm border'>
      <CardContent className='p-4 space-y-4'>
        <div className='flex items-center gap-3'>
          <FileSpreadsheet className='h-5 w-5' />
          <div>
            <h3 className='font-semibold'>Import Vyapar Backup</h3>
            <p className='text-sm text-muted-foreground'>Upload Excel/CSV backup and auto import data.</p>
          </div>
        </div>

        <input ref={inputRef} type='file' className='hidden' accept='.xlsx,.xls,.csv,.zip,.json' onChange={onFileChange} />

        <Button onClick={pickFile} disabled={loading} className='w-full rounded-2xl'>
          {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Upload className='mr-2 h-4 w-4' />}
          {loading ? 'Importing...' : 'Choose Vyapar File'}
        </Button>

        {(loading || progress > 0) && (
          <div className='space-y-2'>
            <Progress value={progress} />
            <div className='text-sm text-muted-foreground flex items-center gap-2'>
              {progress === 100 ? <CheckCircle2 className='h-4 w-4' /> : loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <AlertCircle className='h-4 w-4' />}
              <span>{message}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
