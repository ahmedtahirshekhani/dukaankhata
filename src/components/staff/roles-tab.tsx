"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Lock, Loader2, SearchIcon, XIcon, PlusCircle, Edit, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { usePermissions } from "@/hooks/use-permissions";
import { staffCache } from "@/lib/cache/staff-cache";

export function RolesTab() {
  const t = useTranslations("staffManagement");
  const tCommon = useTranslations("common");
  const { can } = usePermissions();
  const canCreate = can("staff", "create");
  const canEdit = can("staff", "edit");
  const canDelete = can("staff", "delete");
  const [isLoading, setIsLoading] = useState(true);

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [roles, setRoles] = useState<any[]>([]);
  const [rawModules, setRawModules] = useState<any[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  
  // Form State
  const [roleName, setRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Feature Toggles
  const [enableCounterSale, setEnableCounterSale] = useState(true);
  const [enableAiChat, setEnableAiChat] = useState(true);
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);

  // Direct DB Fetch via API with caching
  const fetchRolesAndModules = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = staffCache.getRoles();
      if (cached) {
        setRoles(cached.roles);
        setRawModules(cached.modules);
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      const [rolesRes, modulesRes] = await Promise.all([
        fetch("/api/roles", { cache: "no-store" }),
        fetch("/api/modules")
      ]);

      let loadedRoles: any[] = [];
      let loadedModules: any[] = [];

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        loadedRoles = Array.isArray(rolesData) ? rolesData : [];
        setRoles(loadedRoles);
      } else {
        toast.error("Failed to fetch roles");
      }

      if (modulesRes.ok) {
        const modulesData = await modulesRes.json();
        loadedModules = Array.isArray(modulesData) ? modulesData : [];
        setRawModules(loadedModules);
      }

      staffCache.setRoles({ roles: loadedRoles, modules: loadedModules });
    } catch (err) {
      console.error("Error fetching roles/modules:", err);
      toast.error("Network error while loading roles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCounter = localStorage.getItem("setting_counterSale");
      if (savedCounter) setEnableCounterSale(savedCounter === "true");
      const savedAi = localStorage.getItem("setting_aiChat");
      if (savedAi) setEnableAiChat(savedAi === "true");
      const savedWa = localStorage.getItem("setting_wa");
      if (savedWa) setEnableWhatsApp(savedWa === "true");
    }

    fetchRolesAndModules();
  }, [fetchRolesAndModules]);

  const modules = useMemo(() => {
    return rawModules.filter(mod => {
      if (mod.code === "ai_chat" && !enableAiChat) return false;
      if (mod.code === "whatsapp" && !enableWhatsApp) return false;
      return true;
    }).map(mod => {
      if (!enableCounterSale) {
        return {
          ...mod,
          actions: mod.actions.filter((a: string) => !a.includes("counter_sale"))
        };
      }
      return mod;
    }).filter(mod => mod.actions.length > 0);
  }, [rawModules, enableAiChat, enableWhatsApp, enableCounterSale]);

  const handleOpenModal = (role?: any) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name || "");
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
    if (!roleName.trim()) return toast.error(t("roleNameRequired"));
    
    try {
      setIsSaving(true);
      const payload = { name: roleName, permissions: selectedPerms };
      const roleId = editingRole ? (editingRole.id || editingRole._id) : undefined;
      const url = roleId ? `/api/roles/${roleId}` : "/api/roles";
      const method = roleId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("roleSaveError"));
      }

      toast.success(editingRole ? t("roleUpdatedSuccess") : t("roleCreatedSuccess"));
      setIsModalOpen(false);
      staffCache.invalidateAll();
      await fetchRolesAndModules(true);
    } catch (err: any) {
      toast.error(err.message || t("roleSaveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (roleId: string) => {
    setDeletingId(roleId);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/api/roles/${deletingId}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || t("roleDeleteError"));
        setErrorDialogOpen(true);
        setDeletingId(null);
        return;
      }

      toast.success(t("roleDeletedSuccess"));
      setDeletingId(null);
      staffCache.invalidateAll();
      await fetchRolesAndModules(true);
    } catch (err: any) {
      setErrorMessage(err.message || t("roleDeleteError"));
      setErrorDialogOpen(true);
      setDeletingId(null);
    }
  };

  const filteredRoles = useMemo(() => {
    if (!searchTerm.trim()) return roles;
    const term = searchTerm.toLowerCase();
    return roles.filter((role: any) => role.name?.toLowerCase().includes(term));
  }, [roles, searchTerm]);

  const totalCount = filteredRoles.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const paginatedRoles = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRoles.slice(startIndex, startIndex + pageSize);
  }, [filteredRoles, currentPage, pageSize]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Manage custom roles and their permissions</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchRolesAndModules(true)}
            className="gap-2 h-9 text-xs"
            title="Refresh from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {canCreate && (
            <Button onClick={() => handleOpenModal()} className="gap-2 h-9 text-xs sm:text-sm">
              <PlusCircle className="w-4 h-4" /> {t("createRole")}
            </Button>
          )}
        </div>
      </div>

      <Card className="flex flex-col gap-4 sm:gap-6 p-2 sm:p-6 shadow-sm border-0 sm:border">
        <CardHeader className="p-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchRolesPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm w-full"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop View */}
          <div className="hidden md:block border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("roleName")}</TableHead>
                  <TableHead>{t("permissions")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      {t("noRecords")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRoles.map((role) => (
                    <TableRow key={role.id || role._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Lock className="w-4 h-4" />
                          </div>
                          {role.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {role.permissions?.length || 0} permissions assigned
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(role)}>
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(role.id || role._id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View - Cards */}
          <div className="md:hidden flex flex-col gap-3 mt-4 md:mt-0">
             {paginatedRoles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                  {t("noRecords")}
                </div>
             ) : (
                paginatedRoles.map((role) => (
                   <Card key={role.id || role._id} className="p-4 shadow-sm border space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                             <Lock className="w-5 h-5" />
                           </div>
                           <div className="flex-1 overflow-hidden">
                             <p className="font-semibold text-sm truncate">{role.name}</p>
                             <p className="text-xs text-muted-foreground">{role.permissions?.length || 0} permissions assigned</p>
                           </div>
                        </div>
                        
                        <div className="flex gap-1 flex-shrink-0">
                           {canEdit && (
                             <Button variant="ghost" size="icon" onClick={() => handleOpenModal(role)} className="h-8 w-8">
                               <Edit className="w-4 h-4 text-muted-foreground" />
                             </Button>
                           )}
                           {canDelete && (
                             <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(role.id || role._id)}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           )}
                        </div>
                      </div>
                   </Card>
                ))
             )}
          </div>
        </CardContent>

        <div className="border-t p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {t("totalCountLabel", { count: totalCount })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {t("rowsPerPage")}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={isPageLoading}
            />
          )}
        </div>
      </Card>

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

      <ErrorDialog
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title={tCommon("error")}
        message={errorMessage}
      />
    </div>
  );
}
