"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Loader2, SearchIcon, FilterIcon, XIcon, PlusCircle, Edit, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations, useLocale } from "next-intl";
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

import { useSession } from "next-auth/react";
import { usePermissions } from "@/hooks/use-permissions";
import { staffCache } from "@/lib/cache/staff-cache";

export function StaffTab() {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("staffManagement");
  const tCommon = useTranslations("common");
  const { can } = usePermissions();
  const canCreate = can("staff", "create");
  const canEdit = can("staff", "edit");
  const canDelete = can("staff", "delete");
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [staff, setStaff] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

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

  // Direct DB Fetch via API with caching
  const fetchStaffAndRoles = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = staffCache.getStaff();
      if (cached) {
        setStaff(cached.staff);
        setRoles(cached.roles);
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      const [staffRes, rolesRes] = await Promise.all([
        fetch("/api/staff", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" })
      ]);

      let loadedStaff: any[] = [];
      let loadedRoles: any[] = [];

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        loadedStaff = Array.isArray(staffData) ? staffData : [];
        setStaff(loadedStaff);
      } else {
        toast.error("Failed to fetch staff");
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        loadedRoles = Array.isArray(rolesData) ? rolesData : [];
        setRoles(loadedRoles);
      }

      staffCache.setStaff({ staff: loadedStaff, roles: loadedRoles });
    } catch (err) {
      console.error("Error fetching staff/roles:", err);
      toast.error("Network error while loading staff");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffAndRoles();
  }, [fetchStaffAndRoles]);

  const handleOpenModal = (staffMember?: any) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setName(staffMember.name || "");
      setEmail(staffMember.email || "");
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return toast.error("Invalid email format");
    }
    
    try {
      setIsSaving(true);
      
      if (!editingStaff) {
        // Direct API call to invite staff
        const res = await fetch("/api/staff/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, role_id: selectedRole })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to invite staff member");
        }
        
        toast.success(data.message || "Invitation sent successfully!");
        setIsModalOpen(false);
        staffCache.invalidateAll();
        await fetchStaffAndRoles(true);
      } else {
        // Direct API call to edit existing staff
        const staffId = editingStaff.id || editingStaff._id;
        const res = await fetch(`/api/staff/${staffId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, role_id: selectedRole })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to update staff member");
        }

        toast.success("Staff member updated successfully");
        setIsModalOpen(false);
        staffCache.invalidateAll();
        await fetchStaffAndRoles(true);
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
      const res = await fetch(`/api/staff/${deletingId}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove staff member");
      }

      toast.success("Staff member removed successfully");
      setDeletingId(null);
      staffCache.invalidateAll();
      await fetchStaffAndRoles(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove staff member");
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((member: any) => {
      // Exclude the currently logged-in user
      if (session?.user?.email && member.email?.toLowerCase() === session.user.email.toLowerCase()) {
        return false;
      }

      // Filter by role
      const matchesRole = roleFilter === "all" || member.role_id === roleFilter || (member.roleData && member.roleData.some((r: any) => (r.id || r._id) === roleFilter));
      if (!matchesRole) return false;

      // Filter by search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = member.name?.toLowerCase().includes(term);
        const matchesEmail = member.email?.toLowerCase().includes(term);
        const matchesRoleName = member.role_name?.toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesRoleName) return false;
      }

      return true;
    });
  }, [staff, roleFilter, searchTerm, session]);

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStaffAndRoles(true)}
            className="gap-2 h-9 text-xs"
            title="Refresh from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {canCreate && (
            <Button onClick={() => handleOpenModal()} className="gap-2 h-9 text-xs sm:text-sm">
              <PlusCircle className="w-4 h-4" /> {t("createStaff")}
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
          {/* Desktop View */}
          <div className="hidden md:block border rounded-md overflow-x-auto">
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
                  paginatedStaff.map((member: any) => (
                    <TableRow key={member.id || member._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {(member.name || member.email || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{member.name}</div>
                            {member.is_pending && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Pending Invitation</span>
                            )}
                          </div>
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
                          ) : member.role_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              {member.role_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No roles assigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.is_pending && member.token && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const link = `${window.location.origin}/${locale}/invite?token=${member.token}`;
                                navigator.clipboard.writeText(link);
                                toast.success("Invitation link copied to clipboard!");
                              }}
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              title="Copy Invite Link"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(member)} className="h-8 w-8">
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => setDeletingId(member.id || member._id)}>
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
             {paginatedStaff.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                  {t("noRecords")}
                </div>
             ) : (
                paginatedStaff.map((member: any) => (
                   <Card key={member.id || member._id} className="p-4 shadow-sm border space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                             {(member.name || member.email || "U").charAt(0).toUpperCase()}
                           </div>
                           <div className="flex-1 overflow-hidden">
                             <p className="font-semibold text-sm truncate">{member.name}</p>
                             <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                             {member.is_pending && (
                               <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Pending Invitation</span>
                             )}
                           </div>
                        </div>
                        
                        <div className="flex gap-1 flex-shrink-0">
                           {member.is_pending && member.token && (
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => {
                                 const link = `${window.location.origin}/${locale}/invite?token=${member.token}`;
                                 navigator.clipboard.writeText(link);
                                 toast.success("Invitation link copied to clipboard!");
                               }}
                               className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                               title="Copy Invite Link"
                             >
                               <Copy className="w-4 h-4" />
                             </Button>
                           )}
                           {canEdit && (
                             <Button variant="ghost" size="icon" onClick={() => handleOpenModal(member)} className="h-8 w-8">
                               <Edit className="w-4 h-4 text-muted-foreground" />
                             </Button>
                           )}
                           {canDelete && (
                             <Button variant="danger" size="icon" className="h-8 w-8" onClick={() => setDeletingId(member.id || member._id)}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                          {member.roles && member.roles.length > 0 ? (
                            member.roles.map((r: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                {r}
                              </span>
                            ))
                          ) : member.role_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              {member.role_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No roles assigned</span>
                          )}
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
