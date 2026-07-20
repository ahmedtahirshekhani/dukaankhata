"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

export function RolesTab() {
  const t = useTranslations("staffManagement");
  const [roles, setRoles] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  
  // Form State
  const [roleName, setRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, modulesRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/modules")
      ]);
      
      if (rolesRes.ok) setRoles(await rolesRes.json());
      if (modulesRes.ok) setModules(await modulesRes.json());
    } catch (err) {
      toast.error("Failed to load roles data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (role?: any) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setSelectedPerms(role.permissions || []);
    } else {
      setEditingRole(null);
      setRoleName("");
      setSelectedPerms([]);
    }
    setIsModalOpen(true);
  };

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSelectAllModule = (mod: any) => {
    const allPermsForMod = mod.actions.map((a: string) => `${mod.code}.${a}`);
    const isAllSelected = allPermsForMod.every((p: string) => selectedPerms.includes(p));

    if (isAllSelected) {
      setSelectedPerms(prev => prev.filter(p => !allPermsForMod.includes(p)));
    } else {
      setSelectedPerms(prev => Array.from(new Set([...prev, ...allPermsForMod])));
    }
  };

  const handleSelectAllGlobal = () => {
    const allPerms = modules.flatMap(mod => mod.actions.map((a: string) => `${mod.code}.${a}`));
    const isAllSelected = allPerms.length > 0 && allPerms.every((p: string) => selectedPerms.includes(p));

    if (isAllSelected) {
      setSelectedPerms([]);
    } else {
      setSelectedPerms(allPerms);
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) return toast.error(t("roleNamePlaceholder")); // better error later if needed, but roleName required
    
    try {
      setIsSaving(true);
      const payload = { name: roleName, permissions: selectedPerms };
      const url = editingRole ? `/api/roles/${editingRole._id}` : "/api/roles";
      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed");
      
      toast.success(editingRole ? "Role updated successfully" : "Role created successfully");
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/roles/${deletingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete role");
      toast.success("Role deleted successfully");
      setDeletingId(null);
      fetchData();
    } catch (err) {
      toast.error("Failed to delete role");
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
        <p className="text-sm text-muted-foreground">Manage custom roles and their permissions</p>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="w-4 h-4" /> {t("createRole")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <div key={role._id} className="p-4 border rounded-xl bg-card shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">{role.name}</h3>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(role)}>
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeletingId(role._id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {role.permissions?.length || 0} permissions assigned
            </div>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
            {t("noRolesFound")}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? t("editRole") : t("createRole")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>{t("roleName")}</Label>
              <Input 
                value={roleName} 
                onChange={(e) => setRoleName(e.target.value)} 
                placeholder={t("roleNamePlaceholder")}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("permissions")}</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAllGlobal}
                  type="button"
                >
                  {t("selectAllPermissions")}
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {modules.map(mod => {
                  const allPermsForMod = mod.actions.map((a: string) => `${mod.code}.${a}`);
                  const isAllSelected = allPermsForMod.every((p: string) => selectedPerms.includes(p));
                  
                  return (
                  <div key={mod.code} className="p-4 border rounded-lg bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{mod.name}</h4>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => handleSelectAllModule(mod)}
                        type="button"
                      >
                        {isAllSelected ? t("deselectAll") : t("selectAll")}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {mod.actions.map((action: string) => {
                        const permString = `${mod.code}.${action}`;
                        const isChecked = selectedPerms.includes(permString);
                        return (
                          <div key={permString} className="flex items-center space-x-2">
                            <Checkbox 
                              id={permString} 
                              checked={isChecked}
                              onCheckedChange={() => handleTogglePerm(permString)}
                            />
                            <Label htmlFor={permString} className="text-sm capitalize font-normal cursor-pointer">
                              {action}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t("saving") : t("saveRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
        title={t("deleteRole")}
        description={t("deleteRoleConfirm")}
        confirmLabel={t("delete")}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
