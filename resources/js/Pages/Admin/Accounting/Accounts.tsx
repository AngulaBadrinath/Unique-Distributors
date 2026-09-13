import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Badge } from '@/Components/ui/badge';
import {
    FolderTree,
    Plus,
    X,
    Edit2,
    Trash2,
    CheckCircle2,
    Shield,
    Receipt,
    HelpCircle
} from 'lucide-react';

interface AccountItem {
    id: number;
    account_code: string;
    name: string;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    category: string;
    normal_balance: 'DEBIT' | 'CREDIT';
    parent_id: number | null;
    is_active: boolean;
    is_system: boolean;
    is_reconcilable: boolean;
    description: string | null;
    children?: AccountItem[];
}

interface Props {
    accounts: AccountItem[];
    hierarchy: AccountItem[];
    account_types: string[];
    account_categories: string[];
    balance_types: string[];
}

export default function AccountsPage({
    accounts,
    hierarchy,
    account_types,
    account_categories,
    balance_types,
}: Props) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
    const [filterType, setFilterType] = useState<string>('ALL');

    const createForm = useForm({
        account_code: '',
        name: '',
        type: 'ASSET',
        category: 'CURRENT_ASSET',
        normal_balance: 'DEBIT',
        parent_id: '',
        is_active: true,
        is_reconcilable: false,
        description: '',
    });

    const editForm = useForm({
        account_code: '',
        name: '',
        parent_id: '',
        is_active: true,
        is_reconcilable: false,
        description: '',
    });

    const handleOpenEdit = (account: AccountItem) => {
        setEditingAccount(account);
        editForm.setData({
            account_code: account.account_code,
            name: account.name,
            parent_id: account.parent_id ? String(account.parent_id) : '',
            is_active: account.is_active,
            is_reconcilable: account.is_reconcilable,
            description: account.description || '',
        });
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/accounting/accounts', {
            onSuccess: () => {
                setIsCreateModalOpen(false);
                createForm.reset();
            },
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount) return;

        editForm.put(`/admin/accounting/accounts/${editingAccount.id}`, {
            onSuccess: () => {
                setEditingAccount(null);
            },
        });
    };

    const handleDeleteAccount = (account: AccountItem) => {
        if (confirm(`Are you sure you want to delete account ${account.account_code} (${account.name})?`)) {
            useForm().delete(`/admin/accounting/accounts/${account.id}`);
        }
    };

    const filteredAccounts = filterType === 'ALL'
        ? accounts
        : accounts.filter((a) => a.type === filterType);

    return (
        <AppLayout title="Chart of Accounts">
            <Head title="Chart of Accounts" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
                            <Badge variant="outline" className="text-xs">
                                {accounts.length} Accounts
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Hierarchical GAAP accounts covering Assets, Liabilities, Equity, Revenue, and Expenses.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="text-xs"
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            New Account
                        </Button>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/40 rounded-lg w-fit border">
                    {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                filterType === type
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {type === 'ALL' ? 'All Accounts' : type}
                        </button>
                    ))}
                </div>

                {/* Accounts Table */}
                <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="py-3 px-4">Code</th>
                                    <th className="py-3 px-4">Account Name</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4">Normal Balance</th>
                                    <th className="py-3 px-4">Classification</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredAccounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                            No accounts found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAccounts.map((account) => (
                                        <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-semibold">
                                                {account.account_code}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{account.name}</span>
                                                    {account.is_system && (
                                                        <span title="System Account (Protected)">
                                                            <Shield className="w-3.5 h-3.5 text-blue-500 inline" />
                                                        </span>
                                                    )}
                                                    {account.is_reconcilable && (
                                                        <span title="Reconcilable Cash/Bank Account">
                                                            <Receipt className="w-3.5 h-3.5 text-emerald-500 inline" />
                                                        </span>
                                                    )}
                                                </div>
                                                {account.description && (
                                                    <p className="text-[11px] text-muted-foreground truncate max-w-sm">
                                                        {account.description}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        account.type === 'ASSET'
                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                                                            : account.type === 'LIABILITY'
                                                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]'
                                                            : account.type === 'EQUITY'
                                                            ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]'
                                                            : account.type === 'REVENUE'
                                                            ? 'bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px]'
                                                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                                                    }
                                                >
                                                    {account.type}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {account.category}
                                            </td>
                                            <td className="py-3 px-4 font-mono">
                                                {account.normal_balance}
                                            </td>
                                            <td className="py-3 px-4">
                                                {account.is_system ? (
                                                    <span className="text-muted-foreground text-[11px]">System Base</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-[11px]">Custom</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        account.is_active
                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                                                            : 'bg-muted text-muted-foreground text-[10px]'
                                                    }
                                                >
                                                    {account.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link href={`/admin/accounting/general-ledger?account_id=${account.id}`}>
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                                            Ledger
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleOpenEdit(account)}
                                                        className="h-7 w-7 p-0"
                                                        title="Edit Account"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </Button>
                                                    {!account.is_system && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteAccount(account)}
                                                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            title="Delete Account"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create Account Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h2 className="text-base font-semibold">New Chart of Accounts Entry</h2>
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                                <div>
                                    <label className="block font-medium mb-1">Account Code *</label>
                                    <Input
                                        value={createForm.data.account_code}
                                        onChange={(e) => createForm.setData('account_code', e.target.value)}
                                        placeholder="e.g. 1040, 5050"
                                        required
                                    />
                                    {createForm.errors.account_code && (
                                        <p className="text-red-500 mt-1">{createForm.errors.account_code}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block font-medium mb-1">Account Name *</label>
                                    <Input
                                        value={createForm.data.name}
                                        onChange={(e) => createForm.setData('name', e.target.value)}
                                        placeholder="e.g. Petty Cash, Marketing Expense"
                                        required
                                    />
                                    {createForm.errors.name && (
                                        <p className="text-red-500 mt-1">{createForm.errors.name}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-medium mb-1">Account Type *</label>
                                        <select
                                            value={createForm.data.type}
                                            onChange={(e) => createForm.setData('type', e.target.value)}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                        >
                                            {account_types.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-medium mb-1">Category *</label>
                                        <select
                                            value={createForm.data.category}
                                            onChange={(e) => createForm.setData('category', e.target.value)}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                        >
                                            {account_categories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-medium mb-1">Parent Account (Optional)</label>
                                    <select
                                        value={createForm.data.parent_id}
                                        onChange={(e) => createForm.setData('parent_id', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                    >
                                        <option value="">None (Top-Level Account)</option>
                                        {accounts.map((acc) => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.account_code} - {acc.name} ({acc.type})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-4 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={createForm.data.is_reconcilable}
                                            onChange={(e) => createForm.setData('is_reconcilable', e.target.checked)}
                                            className="rounded border-input text-primary"
                                        />
                                        <span>Reconcilable Cash/Bank Account</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block font-medium mb-1">Description</label>
                                    <textarea
                                        value={createForm.data.description}
                                        onChange={(e) => createForm.setData('description', e.target.value)}
                                        rows={2}
                                        className="w-full rounded-md border border-input bg-background p-2 text-xs"
                                        placeholder="Purpose and business context for this account"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCreateModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="sm" disabled={createForm.processing}>
                                        {createForm.processing ? 'Creating...' : 'Create Account'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Account Modal */}
                {editingAccount && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border space-y-4">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h2 className="text-base font-semibold">
                                    Edit Account: {editingAccount.account_code}
                                </h2>
                                <button
                                    onClick={() => setEditingAccount(null)}
                                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                                <div>
                                    <label className="block font-medium mb-1">Account Code</label>
                                    <Input
                                        value={editForm.data.account_code}
                                        onChange={(e) => editForm.setData('account_code', e.target.value)}
                                        disabled={editingAccount.is_system}
                                        required
                                    />
                                    {editingAccount.is_system && (
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            System account code is locked.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block font-medium mb-1">Account Name *</label>
                                    <Input
                                        value={editForm.data.name}
                                        onChange={(e) => editForm.setData('name', e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium mb-1">Parent Account</label>
                                    <select
                                        value={editForm.data.parent_id}
                                        onChange={(e) => editForm.setData('parent_id', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                    >
                                        <option value="">None (Top-Level Account)</option>
                                        {accounts
                                            .filter((acc) => acc.id !== editingAccount.id)
                                            .map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.account_code} - {acc.name} ({acc.type})
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-4 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.data.is_active}
                                            onChange={(e) => editForm.setData('is_active', e.target.checked)}
                                            className="rounded border-input text-primary"
                                        />
                                        <span>Active Status</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.data.is_reconcilable}
                                            onChange={(e) => editForm.setData('is_reconcilable', e.target.checked)}
                                            className="rounded border-input text-primary"
                                        />
                                        <span>Reconcilable Account</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block font-medium mb-1">Description</label>
                                    <textarea
                                        value={editForm.data.description}
                                        onChange={(e) => editForm.setData('description', e.target.value)}
                                        rows={2}
                                        className="w-full rounded-md border border-input bg-background p-2 text-xs"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingAccount(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="sm" disabled={editForm.processing}>
                                        {editForm.processing ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
