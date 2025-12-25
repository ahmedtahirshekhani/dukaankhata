'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProtectedRoute } from '@/components/protected-route';

export default function ConfigurationPage({ params }: { params: { locale: string } }) {
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [logoError, setLogoError] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/${params.locale}/api/configuration/assets`);
        const data = await res.json();
        if (res.ok) {
          setCompanyLogo(data.companyLogo || null);
          setSignatureImage(data.signatureImage || null);
        }
      } catch (err) {
        console.error('Failed to load configuration assets', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [params.locale]);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Only image files are allowed.');
      (e.target as HTMLInputElement).value = '';
      return;
    }
    setLogoError('');
    const url = await readFileAsDataUrl(file);
    setCompanyLogo(url);
  };

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSignatureError('Only image files are allowed.');
      (e.target as HTMLInputElement).value = '';
      return;
    }
    setSignatureError('');
    const url = await readFileAsDataUrl(file);
    setSignatureImage(url);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/${params.locale}/api/configuration/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyLogo, signatureImage }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save');
      }
      
      // Update localStorage so invoice can use cached values
      if (companyLogo) {
        localStorage.setItem('companyLogo', companyLogo);
      } else {
        localStorage.removeItem('companyLogo');
      }
      if (signatureImage) {
        localStorage.setItem('invoiceSignature', signatureImage);
      } else {
        localStorage.removeItem('invoiceSignature');
      }
      
      setMessage('Uploads saved to server');
      setTimeout(() => setMessage(''), 2500);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute locale={params.locale}>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{tNav('configuration')}</h1>
            <p className="text-gray-600 mt-2">{tNav('configurationDescription')}</p>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
              {message}
            </div>
          )}

          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Company Logo</CardTitle>
                  <CardDescription>Upload and preview your company logo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="company-logo">Company Logo</Label>
                    <Input id="company-logo" type="file" accept="image/*" onChange={handleLogoChange} />
                    {logoError && (
                      <p className="text-xs text-red-600">{logoError}</p>
                    )}
                    {companyLogo && (
                      <div className="mt-2">
                        <img src={companyLogo} alt="Company Logo" className="h-16 w-auto rounded border" />
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setCompanyLogo(null);
                            }}
                          >{tCommon('delete')}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-8">
                <CardHeader>
                  <CardTitle>Authorized Signature</CardTitle>
                  <CardDescription>Upload and preview the authorized invoice signature</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="authorized-signature">Authorized Signature</Label>
                    <Input id="authorized-signature" type="file" accept="image/*" onChange={handleSignatureChange} />
                    {signatureError && (
                      <p className="text-xs text-red-600">{signatureError}</p>
                    )}
                    {signatureImage && (
                      <div className="mt-2">
                        <img src={signatureImage} alt="Authorized Signature" className="h-16 w-auto rounded border" />
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setSignatureImage(null);
                            }}
                          >{tCommon('delete')}</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Uploads'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
