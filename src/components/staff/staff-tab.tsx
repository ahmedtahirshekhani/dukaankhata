"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "next-intl";

export function StaffTab() {
  const t = useTranslations("staffManagement");
  const [staff, setStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [staffRes, rolesRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/roles")
      ]);
      
      if (staffRes.ok) setStaff(await staffRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
    } catch (err) {
      toast.error("Failed to load staff data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (staffMember?: any) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setName(staffMember.name);
      setEmail(staffMember.email);
      setPassword(""); // Don't show password on edit
      setSelectedRole(staffMember.role_id || "");
    } else {
      setEditingStaff(null);
      setName("");
      setEmail("");
      setPassword("");
      setSelectedRole("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim() || !selectedRole) {
      return toast.error("Name, email, and role are required");
    }
    if (!editingStaff && !password) {
      return toast.error("Password is required for new staff");
    }
    
    try {
      setIsSaving(true);
      const payload: any = { name, email, role_id: selectedRole };
      if (password) payload.password = password;

      const url = editingStaff ? `/api/staff/${editingStaff._id}` : "/api/staff";
      const method = editingStaff ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save staff member");
      }
      
      toast.success(`Staff member ${editingStaff ? "updated" : "created"} successfully`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/staff/${deletingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove staff");
      toast.success("Staff member removed successfully");
      setDeletingId(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to remove staff member");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" /> {t("createStaff")}
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
              <tr>
                <th className="px-6 py-4 font-medium">{t("name")}</th>
                <th className="px-6 py-4 font-medium">{t("email")}</th>
                <th className="px-6 py-4 font-medium">{t("role")}</th>
                <th className="px-6 py-4 font-medium text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((member) => (
                <tr key={member._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {member.name}
                  </td>
                  <td className="px-6 py-4">{member.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 rounded-md text-xs font-medium border border-amber-500/20">
                      {member.role_name || t("noRole")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(member)}>
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(member._id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {staff.length === 0 && (
          <div className="py-12 text-center text-muted-foreground border-t">
            {t("noStaffFound")}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? t("editStaff") : t("createStaff")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={t("namePlaceholder")}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input 
                type="email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder={t("emailPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("password")} {editingStaff && `(${t("leaveBlank")})`}</Label>
              <Input 
                type="password"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder={editingStaff ? t("passwordPlaceholderEdit") : t("passwordPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role._id} value={role._id}>{role.name}</SelectItem>
                  ))}
                  {roles.length === 0 && (
                    <SelectItem value="none" disabled>{t("noRolesAvailable")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("saving") : t("saveStaff")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title={t("deleteStaff")}
        description={t("deleteStaffConfirm")}
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
