"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2 } from "lucide-react";

export default function SettingsPage({
  params,
}: {
  params: { locale: string };
}) {
  const router = useRouter();
  const t = useTranslations("settingsPage");
  const { user, refreshSession } = useUserProfile();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [formDirty, setFormDirty] = useState(false);

  // Delete Account Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    reason: "",
    password: "",
  });
  const [deleteError, setDeleteError] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize form data when user or cached company name is available
  useEffect(() => {
    if (!user) return;
    const cachedCompanyName =
      typeof window !== "undefined"
        ? localStorage.getItem("companyName")
        : null;

    const defaultCompanyName = user.company || cachedCompanyName || "";

    if (typeof window !== "undefined" && user.company) {
      localStorage.setItem("companyName", user.company);
    }

    setFormData({
      name: user.name || "",
      email: user.email || "",
      company: defaultCompanyName,
    });
  }, [user?.id, user?.name, user?.email, user?.company]);

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
        body: JSON.stringify({
          name: formData.name,
          company: formData.company,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update profile");
      }

      // Sync company name to configuration assets as well
      try {
        await fetch(`/${params.locale}/api/configuration/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: formData.company }),
        });
      } catch (err) {
        console.error("Failed to sync configuration assets", err);
      }

      // Update localStorage and dispatch event for UI sync
      if (formData.company) {
        localStorage.setItem("companyName", formData.company);
      } else {
        localStorage.removeItem("companyName");
      }
      window.dispatchEvent(
        new CustomEvent("companyDetailsUpdated", {
          detail: { companyName: formData.company },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("profileDetailsUpdated", {
          detail: { name: formData.name, companyName: formData.company },
        }),
      );

      setMessage(t("profileUpdatedSuccess"));
      // Refresh session so header/user menu reflects new name
      try {
        await refreshSession();
      } catch {}
      setFormDirty(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(t("profileUpdateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("passwordMinimumLength"));
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
        throw new Error(data?.error || "Failed to change password");
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
      setPasswordError(err?.message || t("passwordChangeFailed"));
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");

    // Validation
    if (!deleteForm.reason.trim()) {
      setDeleteError(t("whyDeleteAccountRequired"));
      return;
    }
    if (!deleteForm.password) {
      setDeleteError(t("passwordRequired"));
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(`/${params.locale}/api/auth/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deleteForm.password,
          reason: deleteForm.reason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Map error messages to translations
        let errorKey = "accountDeleteFailed";
        if (data?.error?.includes("password")) {
          errorKey = "invalidPassword";
        } else if (data?.error?.includes("Unauthorized")) {
          errorKey = "unauthorized";
        }
        throw new Error(t(errorKey));
      }

      // Account deleted successfully - clear session and localStorage
      // Clear localStorage
      if (typeof window !== "undefined") {
        localStorage.clear();
      }

      // Sign out and clear NextAuth session/cookie
      await signOut({ redirect: false });

      // Redirect to home
      setShowDeleteModal(false);
      router.push(`/${params.locale}`);
    } catch (err: any) {
      setDeleteError(err?.message || t("accountDeleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ProtectedRoute locale={params.locale}>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{t("settings")}</h1>
            <p className="text-gray-600 mt-2">{t("manageAccountSettings")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("profileInformation")}</CardTitle>
              <CardDescription>{t("updatePersonalInfo")}</CardDescription>
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
                  <p className="text-xs text-gray-500">
                    {t("emailCannotBeChanged")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">{t("company")}</Label>
                  <Input
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    disabled={isSaving}
                    placeholder={t("companyNamePlaceholder")}
                  />
                </div>

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
              <CardTitle>{t("security")}</CardTitle>
              <CardDescription>{t("updateSecuritySettings")}</CardDescription>
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

          <Card className="mt-8 border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-red-600">{t("dangerZone")}</CardTitle>
              <CardDescription>{t("deleteAccountDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
              >
                {t("deleteAccountButton")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Account Modal */}
      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteForm({
              reason: "",
              password: "",
            });
            setDeleteError("");
          }
          setShowDeleteModal(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t("deleteAccountTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("deleteAccountWarning")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeleteAccount} className="space-y-4">
            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {deleteError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="delete-reason">
                {t("whyDeleteAccount")} <span className="text-red-600">*</span>
              </Label>
              <textarea
                id="delete-reason"
                value={deleteForm.reason}
                onChange={(e) =>
                  setDeleteForm((p) => ({ ...p, reason: e.target.value }))
                }
                placeholder={t("whyDeleteAccountPlaceholder")}
                className="w-full min-h-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isDeleting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-password">
                {t("enterPassword")} <span className="text-red-600">*</span>
              </Label>
              <Input
                id="delete-password"
                type="password"
                value={deleteForm.password}
                onChange={(e) =>
                  setDeleteForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder={t("enterPasswordDescription")}
                disabled={isDeleting}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteForm({ reason: "", password: "" });
                  setDeleteError("");
                }}
                disabled={isDeleting}
              >
                {t("cancelDeletion")}
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("deleteAccountButton")}
                  </>
                ) : (
                  t("confirmDeletion")
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
