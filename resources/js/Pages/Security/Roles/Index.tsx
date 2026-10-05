import React, { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ManagedUser, PageProps, RoleOption } from '@/types';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Input } from '@/Components/ui/input';
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    Users,
    Search,
    Filter,
    UserCheck,
    Clock,
    Lock,
    Info,
} from 'lucide-react';

interface RolesIndexProps extends PageProps {
    users: ManagedUser[];
    availableRoles: RoleOption[];
    canAssignSuperAdmin: boolean;
    canDeleteUser?: boolean;
    currentUser: {
        id: number;
        role: string | null;
    };
    status?: string | null;
}

export default function RolesIndex({
    users,
    availableRoles,
    canAssignSuperAdmin,
    canDeleteUser = false,
    currentUser,
    status,
}: RolesIndexProps) {
    const { flash, errors: pageErrors } = usePage<RolesIndexProps>().props;

    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
    const [targetRole, setTargetRole] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Lifecycle status modal state
    const [statusModalUser, setStatusModalUser] = useState<ManagedUser | null>(null);
    const [targetStatus, setTargetStatus] = useState<string>('ACTIVE');
    const [statusReason, setStatusReason] = useState<string>('');

    // Delete modal state
    const [deleteModalUser, setDeleteModalUser] = useState<ManagedUser | null>(null);
    const [deleteReason, setDeleteReason] = useState<string>('');
    const [deleteConfirmed, setDeleteConfirmed] = useState<boolean>(false);

    // Filter users
    const filteredUsers = users.filter((u) => {
        const matchesSearch =
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    // Close modals and reset state
    const closeModal = () => {
        setSelectedUser(null);
        setTargetRole('');
        setReason('');
        setFormError(null);
    };

    const closeStatusModal = () => {
        setStatusModalUser(null);
        setTargetStatus('ACTIVE');
        setStatusReason('');
        setFormError(null);
    };

    const closeDeleteModal = () => {
        setDeleteModalUser(null);
        setDeleteReason('');
        setDeleteConfirmed(false);
        setFormError(null);
    };

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedUser) closeModal();
                if (statusModalUser) closeStatusModal();
                if (deleteModalUser) closeDeleteModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedUser, statusModalUser, deleteModalUser]);

    const openRoleModal = (user: ManagedUser) => {
        setSelectedUser(user);
        setTargetRole(user.role || availableRoles[0]?.value || 'SALESMAN');
        setReason('');
        setFormError(null);
    };

    const openStatusModal = (user: ManagedUser) => {
        setStatusModalUser(user);
        setTargetStatus(user.status || 'ACTIVE');
        setStatusReason('');
        setFormError(null);
    };

    const openDeleteModal = (user: ManagedUser) => {
        setDeleteModalUser(user);
        setDeleteReason('');
        setDeleteConfirmed(false);
        setFormError(null);
    };

    const handleRoleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setIsSubmitting(true);
        setFormError(null);

        router.put(
            `/security/users/${selectedUser.id}/role`,
            {
                role: targetRole,
                reason: reason.trim() || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeModal();
                    setIsSubmitting(false);
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    if (errs.role) {
                        setFormError(errs.role);
                    } else if (errs.reason) {
                        setFormError(errs.reason);
                    } else {
                        const firstError = Object.values(errs)[0];
                        setFormError(firstError || 'An error occurred while updating the user role.');
                    }
                },
            }
        );
    };

    const handleStatusSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!statusModalUser) return;

        setIsSubmitting(true);
        setFormError(null);

        router.put(
            `/security/users/${statusModalUser.id}/status`,
            {
                status: targetStatus,
                reason: statusReason.trim() || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    closeStatusModal();
                    setIsSubmitting(false);
                },
                onError: (errs) => {
                    setIsSubmitting(false);
                    const firstError = Object.values(errs)[0];
                    setFormError(firstError || 'An error occurred while updating the account status.');
                },
            }
        );
    };

    const handleDeleteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!deleteModalUser) return;

        if (deleteReason.trim().length < 10) {
            setFormError('A detailed reason (at least 10 characters) is required to delete an account.');
            return;
        }

        if (!deleteConfirmed) {
            setFormError('You must acknowledge and confirm the deletion.');
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        router.delete(`/security/users/${deleteModalUser.id}`, {
            data: {
                reason: deleteReason.trim(),
                confirm: true,
            },
            preserveScroll: true,
            onSuccess: () => {
                closeDeleteModal();
                setIsSubmitting(false);
            },
            onError: (errs) => {
                setIsSubmitting(false);
                const firstError = Object.values(errs)[0];
                setFormError(firstError || 'Failed to delete user account.');
            },
        });
    };

    const getStatusBadge = (statusValue: string) => {
        switch (statusValue?.toUpperCase()) {
            case 'ACTIVE':
                return (
                    <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Active
                    </Badge>
                );
            case 'SUSPENDED':
                return (
                    <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Suspended
                    </Badge>
                );
            case 'DISABLED':
                return (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Disabled
                    </Badge>
                );
            case 'INVITED':
                return (
                    <Badge variant="info" className="gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Invited
                    </Badge>
                );
            default:
                return <Badge variant="outline">{statusValue || 'Unknown'}</Badge>;
        }
    };

    const getRoleBadge = (roleValue: string | null) => {
        if (!roleValue) {
            return (
                <Badge variant="outline" className="text-muted-foreground">
                    Unassigned
                </Badge>
            );
        }

        const roleOption = availableRoles.find((r) => r.value === roleValue);
        const label = roleOption?.label || roleValue;

        if (roleValue === 'SUPER_ADMIN') {
            return (
                <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                </Badge>
            );
        }

        if (roleValue === 'ADMIN') {
            return (
                <Badge variant="warning" className="gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                </Badge>
            );
        }

        if (roleValue === 'ACCOUNTANT') {
            return (
                <Badge variant="info" className="gap-1">
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                </Badge>
            );
        }

        return (
            <Badge variant="secondary" className="gap-1">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
            </Badge>
        );
    };

    const isTargetSuperAdmin = selectedUser?.role === 'SUPER_ADMIN';
    const isNewSuperAdmin = targetRole === 'SUPER_ADMIN';
    const isSelf = selectedUser?.id === currentUser.id;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Head title="Role & Account Lifecycle — Security" />

            {/* Header Navigation */}
            <header className="border-b bg-card">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Link
                                href="/dashboard"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                aria-label="Back to Dashboard"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                                    Role & Account Lifecycle Management
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Authoritative Primary Role Assignments & Account Lifecycle Governance
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link href="/security/mfa">
                                <Button variant="outline" size="sm" className="min-h-[44px]">
                                    <Shield className="mr-2 h-4 w-4" />
                                    MFA Settings
                                </Button>
                            </Link>
                            <Link href="/security/sessions">
                                <Button variant="outline" size="sm" className="min-h-[44px]">
                                    <Lock className="mr-2 h-4 w-4" />
                                    Sessions
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {/* Flash Success Message */}
                {(flash?.success || status) && (
                    <div
                        role="status"
                        className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div className="text-sm font-medium">{flash?.success || status}</div>
                    </div>
                )}

                {/* Flash Error Message */}
                {(flash?.error || pageErrors?.role) && (
                    <div
                        role="alert"
                        className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
                    >
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                        <div className="text-sm font-medium">
                            {flash?.error || pageErrors?.role}
                        </div>
                    </div>
                )}

                {/* Information Callout */}
                <div className="mb-6 rounded-lg border bg-card p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
                        <div className="text-sm">
                            <h2 className="font-semibold text-foreground">
                                Primary Role Model & Account Governance
                            </h2>
                            <p className="mt-1 text-muted-foreground leading-relaxed">
                                Each user is assigned exactly <strong>one primary canonical role</strong>.
                                Role changes and status modifications (Activate, Suspend, Disable) are executed atomically with database row locking. To preserve
                                system integrity, updating status or roles immediately revokes all active
                                sessions. Non-active accounts possess zero effective permissions.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters & Search Controls */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name or email..."
                            className="pl-9 min-h-[44px]"
                            aria-label="Search users"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <label htmlFor="role-filter" className="text-sm font-medium text-muted-foreground sr-only sm:not-sr-only">
                            Role Filter:
                        </label>
                        <select
                            id="role-filter"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="ALL">All Roles ({users.length})</option>
                            {availableRoles.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Users Table (Desktop) & Cards (Mobile/Tablet) */}
                <Card>
                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                    <Users className="h-5 w-5 text-muted-foreground" />
                                    Users ({filteredUsers.length})
                                </CardTitle>
                                <CardDescription>
                                    View and manage authoritative roles and account lifecycles
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    {filteredUsers.length === 0 ? (
                        <div className="py-12 text-center">
                            <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
                            <h3 className="mt-3 text-sm font-semibold text-foreground">No users found</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Try adjusting your search query or role filter.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-left text-sm" aria-label="System Users and Roles">
                                    <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                                        <tr>
                                            <th scope="col" className="px-6 py-3.5">User</th>
                                            <th scope="col" className="px-6 py-3.5">Status</th>
                                            <th scope="col" className="px-6 py-3.5">Current Role</th>
                                            <th scope="col" className="px-6 py-3.5">Privilege</th>
                                            <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredUsers.map((user) => {
                                            const roleOption = availableRoles.find((r) => r.value === user.role);
                                            const isPrivileged = roleOption?.is_privileged ?? false;
                                            const isCurrentUser = user.id === currentUser.id;
                                            const canModifyRole = !isCurrentUser && (canAssignSuperAdmin || user.role !== 'SUPER_ADMIN');
                                            const canModifyStatus = !isCurrentUser;
                                            const canDeleteThisUser = canDeleteUser && !isCurrentUser;

                                            return (
                                                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-foreground">{user.name}</div>
                                                        <div className="text-xs text-muted-foreground">{user.email}</div>
                                                        {isCurrentUser && (
                                                            <span className="inline-block mt-1 text-[11px] font-medium text-primary">
                                                                (Current User — Self Modification Prohibited)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {getStatusBadge(user.status)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {getRoleBadge(user.role)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isPrivileged ? (
                                                             <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                                                <Lock className="h-3 w-3" /> Privileged (MFA Mandatory)
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">
                                                                Standard Access
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={!canModifyStatus}
                                                                onClick={() => openStatusModal(user)}
                                                                className="min-h-[36px]"
                                                                title="Manage Account Lifecycle Status"
                                                            >
                                                                Status
                                                            </Button>

                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={!canModifyRole}
                                                                onClick={() => openRoleModal(user)}
                                                                className="min-h-[36px]"
                                                                title={
                                                                    isCurrentUser
                                                                        ? 'Users cannot modify their own role'
                                                                        : !canModifyRole
                                                                        ? 'Only Super Administrators can modify a Super Administrator'
                                                                        : 'Change User Role'
                                                                }
                                                            >
                                                                Role
                                                            </Button>

                                                            {canDeleteUser && (
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    disabled={!canDeleteThisUser}
                                                                    onClick={() => openDeleteModal(user)}
                                                                    className="min-h-[36px]"
                                                                    title={isCurrentUser ? 'Cannot delete own account' : 'Delete or Safely Retire Account'}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile / Tablet Cards View */}
                            <div className="lg:hidden divide-y">
                                {filteredUsers.map((user) => {
                                    const roleOption = availableRoles.find((r) => r.value === user.role);
                                    const isPrivileged = roleOption?.is_privileged ?? false;
                                    const isCurrentUser = user.id === currentUser.id;
                                    const canModifyRole = !isCurrentUser && (canAssignSuperAdmin || user.role !== 'SUPER_ADMIN');
                                    const canModifyStatus = !isCurrentUser;
                                    const canDeleteThisUser = canDeleteUser && !isCurrentUser;

                                    return (
                                        <div key={user.id} className="p-4 sm:p-6 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="font-semibold text-foreground text-base">
                                                        {user.name}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                                    {isCurrentUser && (
                                                        <span className="text-xs font-medium text-primary">
                                                            Current User (Self Modification Prohibited)
                                                        </span>
                                                    )}
                                                </div>
                                                <div>{getStatusBadge(user.status)}</div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                <span className="text-xs text-muted-foreground">Role:</span>
                                                {getRoleBadge(user.role)}
                                                {isPrivileged && (
                                                    <Badge variant="warning" className="text-[11px] gap-1">
                                                        <Lock className="h-3 w-3" /> Privileged
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="pt-2 flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!canModifyStatus}
                                                    onClick={() => openStatusModal(user)}
                                                    className="flex-1 min-h-[44px]"
                                                >
                                                    Status
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!canModifyRole}
                                                    onClick={() => openRoleModal(user)}
                                                    className="flex-1 min-h-[44px]"
                                                >
                                                    Change Role
                                                </Button>

                                                {canDeleteUser && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        disabled={!canDeleteThisUser}
                                                        onClick={() => openDeleteModal(user)}
                                                        className="min-h-[44px]"
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </Card>
            </main>

            {/* Role Change Modal Dialog */}
            {selectedUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    aria-describedby="modal-description"
                >
                    <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-5 animate-in fade-in-0 zoom-in-95">
                        <div className="flex items-start justify-between border-b pb-4">
                            <div>
                                <h2 id="modal-title" className="text-lg font-bold text-foreground">
                                    Assign User Role
                                </h2>
                                <p id="modal-description" className="text-xs text-muted-foreground mt-0.5">
                                    Updating role for <span className="font-semibold text-foreground">{selectedUser.name}</span> ({selectedUser.email})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                aria-label="Close dialog"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Error Alert */}
                        {formError && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
                            >
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>{formError}</div>
                            </div>
                        )}

                        <form onSubmit={handleRoleSubmit} className="space-y-4">
                            {/* Current Role Display */}
                            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Current Role:</span>
                                <div>{getRoleBadge(selectedUser.role)}</div>
                            </div>

                            {/* New Role Selector */}
                            <div className="space-y-2">
                                <label htmlFor="new-role-select" className="text-sm font-semibold text-foreground">
                                    Select New Role <span className="text-destructive">*</span>
                                </label>
                                <select
                                    id="new-role-select"
                                    value={targetRole}
                                    onChange={(e) => setTargetRole(e.target.value)}
                                    className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    required
                                >
                                    {availableRoles.map((role) => {
                                        const disabled = role.value === 'SUPER_ADMIN' && !canAssignSuperAdmin;
                                        return (
                                            <option key={role.value} value={role.value} disabled={disabled}>
                                                {role.label} {role.is_privileged ? '(Privileged)' : ''} {disabled ? '— Super Admin Only' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                {availableRoles.find((r) => r.value === targetRole)?.description && (
                                    <p className="text-xs text-muted-foreground">
                                        {availableRoles.find((r) => r.value === targetRole)?.description}
                                    </p>
                                )}
                            </div>

                            {/* Reason for Role Change */}
                            <div className="space-y-2">
                                <label htmlFor="role-reason" className="text-sm font-semibold text-foreground">
                                    Reason for Role Change <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                                </label>
                                <Input
                                    id="role-reason"
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Department transfer, promotion, security compliance"
                                    maxLength={255}
                                    className="min-h-[44px]"
                                />
                            </div>

                            {/* High-Risk Warning for Super Admin Changes */}
                            {(isTargetSuperAdmin || isNewSuperAdmin) && (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60 p-3.5 text-amber-900 dark:text-amber-200 space-y-1.5">
                                    <div className="flex items-center gap-2 font-semibold text-xs">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                        HIGH-RISK ACTION: Super Administrator Transition
                                    </div>
                                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                                        Super Administrator status grants comprehensive system and security governance authority.
                                        Demoting the last remaining Super Administrator is strictly prohibited by system safety invariants.
                                    </p>
                                </div>
                            )}

                            {/* Session Revocation Warning */}
                            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <div>
                                    <strong>Security Notice:</strong> Applying this role change will immediately invalidate all
                                    active sessions for <strong>{selectedUser.name}</strong>, requiring them to sign in again under their new role and MFA requirements.
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-3 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeModal}
                                    disabled={isSubmitting}
                                    className="min-h-[44px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || isSelf || (isNewSuperAdmin && !canAssignSuperAdmin)}
                                    className="min-h-[44px]"
                                >
                                    {isSubmitting ? 'Updating Role...' : 'Confirm & Assign Role'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Lifecycle Status Modal Dialog */}
            {statusModalUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="status-modal-title"
                >
                    <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-5 animate-in fade-in-0 zoom-in-95">
                        <div className="flex items-start justify-between border-b pb-4">
                            <div>
                                <h2 id="status-modal-title" className="text-lg font-bold text-foreground">
                                    Manage Account Lifecycle Status
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Updating lifecycle status for <span className="font-semibold text-foreground">{statusModalUser.name}</span> ({statusModalUser.email})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeStatusModal}
                                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                aria-label="Close dialog"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Error Alert */}
                        {formError && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
                            >
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>{formError}</div>
                            </div>
                        )}

                        <form onSubmit={handleStatusSubmit} className="space-y-4">
                            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Current Status:</span>
                                <div>{getStatusBadge(statusModalUser.status)}</div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="status-select" className="text-sm font-semibold text-foreground">
                                    New Lifecycle Status <span className="text-destructive">*</span>
                                </label>
                                <select
                                    id="status-select"
                                    value={targetStatus}
                                    onChange={(e) => setTargetStatus(e.target.value)}
                                    className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    required
                                >
                                    <option value="ACTIVE">ACTIVE (Normal operational permissions)</option>
                                    <option value="SUSPENDED">SUSPENDED (Temporarily locked out, zero effective permissions)</option>
                                    <option value="DISABLED">DISABLED (Indefinitely deactivated, zero effective permissions)</option>
                                    <option value="INVITED">INVITED (Awaiting onboarding activation)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="status-reason" className="text-sm font-semibold text-foreground">
                                    Reason for Status Modification <span className="text-xs font-normal text-muted-foreground">(Audited)</span>
                                </label>
                                <Input
                                    id="status-reason"
                                    type="text"
                                    value={statusReason}
                                    onChange={(e) => setStatusReason(e.target.value)}
                                    placeholder="e.g. Leave of absence, security incident, contract end"
                                    maxLength={255}
                                    className="min-h-[44px]"
                                />
                            </div>

                            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <div>
                                    <strong>Session Invalidation:</strong> Updating account status will immediately revoke all active web sessions for this user.
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-3 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeStatusModal}
                                    disabled={isSubmitting}
                                    className="min-h-[44px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || statusModalUser.id === currentUser.id}
                                    className="min-h-[44px]"
                                >
                                    {isSubmitting ? 'Updating Status...' : 'Apply Status Change'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Permanent Delete Confirmation Modal Dialog */}
            {deleteModalUser && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-modal-title"
                >
                    <div className="relative w-full max-w-lg rounded-xl border border-destructive/50 bg-card p-6 shadow-xl space-y-5 animate-in fade-in-0 zoom-in-95">
                        <div className="flex items-start justify-between border-b pb-4">
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="h-6 w-6" />
                                <h2 id="delete-modal-title" className="text-lg font-bold">
                                    Confirm Account Deletion / Retirement
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                aria-label="Close dialog"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Error Alert */}
                        {formError && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
                            >
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>{formError}</div>
                            </div>
                        )}

                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3.5 text-xs space-y-2">
                            <p className="font-semibold text-destructive">
                                Target Account: {deleteModalUser.name} ({deleteModalUser.email}) — Role: {deleteModalUser.role || 'Unassigned'}
                            </p>
                            <p className="text-muted-foreground leading-relaxed">
                                Deleting an account will revoke all sessions and access tokens. If the account is linked to historical business records (orders, payments, invoices, or audit entries), the system will safely retire and anonymize the user to preserve relational accounting integrity.
                            </p>
                        </div>

                        <form onSubmit={handleDeleteSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="delete-reason" className="text-sm font-semibold text-foreground">
                                    Deletion Reason <span className="text-destructive">* (Min 10 characters)</span>
                                </label>
                                <Input
                                    id="delete-reason"
                                    type="text"
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="e.g. Employee offboarding per ticket #SEC-1204"
                                    minLength={10}
                                    maxLength={255}
                                    className="min-h-[44px]"
                                    required
                                />
                            </div>

                            <div className="flex items-start gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="confirm-delete"
                                    checked={deleteConfirmed}
                                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-input text-destructive focus:ring-destructive"
                                    required
                                />
                                <label htmlFor="confirm-delete" className="text-xs text-muted-foreground leading-tight">
                                    I confirm that I have verified the identity and authorization to remove this account, and I understand this action is permanent and audited.
                                </label>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-3 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeDeleteModal}
                                    disabled={isSubmitting}
                                    className="min-h-[44px]"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="destructive"
                                    disabled={isSubmitting || deleteReason.trim().length < 10 || !deleteConfirmed}
                                    className="min-h-[44px]"
                                >
                                    {isSubmitting ? 'Deleting Account...' : 'Permanently Delete User'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
