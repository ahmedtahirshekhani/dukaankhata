"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Loader2, SearchIcon, FilterIcon, XIcon, PlusCircle, Edit } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useOfflineStaff, useOfflineRoles } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { db } from "@/lib/db/offline-db";

export function StaffTab() {
  const t = useTranslations("staffManagement");
  const tCommon = useTranslations("common");
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const staff = useOfflineStaff(searchTerm) || [];
  const roles = useOfflineRoles() || [];

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPageLoading, setIsPageLoading] = useState(false);

  useEffect(() => {
    // fetchData is no longer needed with offline hooks
  }, []);


  const handleOpenModal = (staffMember?: any) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setName(staffMember.name);
      setEmail(staffMember.email);
      setSelectedRole(staffMember.role_id || "");
    } else {
      setEditingStaff(null);
      setName("");
      setEmail("");
      setSelectedRole("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!email.trim() || !selectedRole) {
      return toast.error("Email and role are required");
    }
    
    try {
      setIsSaving(true);
      
      if (!editingStaff) {
        // Queue new invite offline
        const payload = { email, role_id: selectedRole };
        const tempId = `temp-inv-${Date.now()}`;
        
        await SyncEngine.queueOperation("invitations", "POST", "/api/staff/invite", payload, tempId);
        
        toast.success("Invitation queued! It will be sent automatically.");
        setIsModalOpen(false);
      } else {
        // Edit existing staff
        const payload: any = { name, email, role_id: selectedRole };
        const staffId = editingStaff.id || editingStaff._id;
        const url = `/api/staff/${staffId}`;

        const localData = {
          ...payload,
          id: staffId,
        };

        await db.users.put(localData);
        
        // Also update role mappings in user_roles so it shows up immediately offline
        const tempUserRole = { id: `temp-ur-${Date.now()}`, user_id: localData.id, role_id: selectedRole };
        
        // Find existing to update if needed
        const existing = await db.user_roles.filter(ur => String(ur.user_id) === String(staffId)).toArray();
        if (existing.length > 0) {
          const existingIds = existing.map(e => e.id).filter(Boolean);
          if (existingIds.length > 0) {
            await db.user_roles.bulkDelete(existingIds);
          }
        }
        
        await db.user_roles.put(tempUserRole);

        await SyncEngine.queueOperation("users", "PUT", url, payload, localData.id);
        
        toast.success("Staff member updated successfully");
        setIsModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await db.users.delete(deletingId);
      
      // Clean up user_roles offline
      const existing = await db.user_roles.filter(ur => String(ur.user_id) === String(deletingId)).toArray();
      const existingIds = existing.map(e => e.id).filter(Boolean);
      if (existingIds.length > 0) {
        await db.user_roles.bulkDelete(existingIds);
      }

      await SyncEngine.queueOperation("users", "DELETE", `/api/staff/${deletingId}`, null, deletingId);
      toast.success("Staff member removed successfully");
      setDeletingId(null);
    } catch (err) {
      toast.error("Failed to remove staff member");
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role_id === roleFilter || (member.roleData && member.roleData.some((r: any) => (r.id || r._id) === roleFilter));
      return matchesRole;
    });
  }, [staff, roleFilter]);

  const totalCount = filteredStaff.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const paginatedStaff = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStaff.slice(startIndex, startIndex + pageSize);
  }, [filteredStaff, currentPage, pageSize]);

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
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <PlusCircle className="w-4 h-4" /> {t("createStaff")}
        </Button>
      </div>

      <Card className="flex flex-col gap-6 p-6">
        <CardHeader className="p-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchStaffPlaceholder")}
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
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 shrink-0">
                      <FilterIcon className="w-4 h-4" />
                      <span>{tCommon("filter")}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel>{t("filterByRole")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={roleFilter === "all"}
                      onCheckedChange={(checked) => checked && setRoleFilter("all")}
                    >
                      {t("allRoles")}
                    </DropdownMenuCheckboxItem>
                    {roles.map((r) => {
                      const rId = r.id || r._id;
                      return (
                        <DropdownMenuCheckboxItem
                          key={rId}
                          checked={roleFilter === rId}
                          onCheckedChange={(checked) => checked && setRoleFilter(rId)}
                        >
                          {r.name}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      {t("noRecords")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStaff.map((member) => (
                    <TableRow key={member.id || member._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          {member.name}
                        </div>
                      </TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.roles && member.roles.length > 0 ? (
                            member.roles.map((r: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No roles assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(member)}>
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => setDeletingId(member.id || member._id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? t("editStaff") : t("inviteStaff", { defaultValue: "Invite Staff" })}</DialogTitle>
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
              <Label>{t("role")}</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id || role._id} value={role.id || role._id}>{role.name}</SelectItem>
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
