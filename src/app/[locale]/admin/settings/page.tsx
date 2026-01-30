"use client";

import { useEffect, useState } from "react";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProtectedRoute } from "@/components/protected-route";

export default function SettingsPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = useTranslations("settings");
  const { user, refreshSession } = useUserProfile();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [formDirty, setFormDirty] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form data when user first loads
  useEffect(() => {
    if (user && !initialized) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
      });
      setInitialized(true);
    }
  }, [user?.id, initialized]);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormDirty(true);
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch(`/${params.locale}/api/users/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(t("profileUpdatedFailed"));
      }
      setMessage(t("profileUpdatedSuccess"));
      // Refresh session so header/user menu reflects new name
      try {
        await refreshSession();
      } catch {}
      setFormDirty(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(t("profileUpdatedFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("passwordTooShort"));
      return;
    }
    try {
      const res = await fetch(`/${params.locale}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(t("passwordChangeFailed"));
      }
      setMessage(t("passwordChangedSuccess"));
      setShowPasswordForm(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setPasswordError(t("passwordChangeFailed"));
    }
  };

  return (
    <ProtectedRoute locale={params.locale}>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
            <p className="text-gray-600 mt-2">{t("pageDescription")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("profileTitle")}</CardTitle>
              <CardDescription>{t("profileDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {message && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                    {message}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">{t("fullName")}</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">{t("emailReadOnly")}</p>
                </div>

                {user?.company && (
                  <div className="space-y-2">
                    <Label>{t("company")}</Label>
                    <Input
                      value={user.company}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                )}

                <div className="flex gap-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? t("saving") : t("saveChanges")}
                  </Button>
                  <Button type="button" variant="outline">
                    {t("cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{t("securityTitle")}</CardTitle>
              <CardDescription>{t("securityDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              {!showPasswordForm ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setShowPasswordForm(true)}
                >
                  {t("changePassword")}
                </Button>
              ) : (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="space-y-4 max-w-md"
                >
                  {passwordError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      {passwordError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="current-password">
                      {t("currentPassword")}
                    </Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          currentPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{t("newPassword")}</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          newPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">
                      {t("confirmNewPassword")}
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((p) => ({
                          ...p,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">{t("savePassword")}</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordForm({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                        setPasswordError("");
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
