/**
 * DeveloperDashboard.jsx
 * Full developer panel with sidebar, Companies tab, and Manage Rules tab.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import RuleModal from '../components/RuleModal';

// ── Sidebar nav items ──────────────────────────────────────────────────────
const NAV = [
    {
        id: 'companies', label: 'Companies',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
    {
        id: 'rules', label: 'Manage Rules',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        ),
    },
];

// ── Impact badge ──────────────────────────────────────────────────────
function ImpactBadge({ impact }) {
    const map = {
        Imprisonment: 'bg-red-900/60 text-red-300 border-red-700',
        High: 'bg-orange-900/60 text-orange-300 border-orange-700',
        Medium: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
        Low: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
    };
    return (
        <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${map[impact] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
            {impact ?? '—'}
        </span>
    );
}

// ── Companies Tab ─────────────────────────────────────────────────────
function CompaniesTab() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/developer/companies')
            .then(r => setCompanies(r.data))
            .catch(() => setError('Failed to load companies.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner label="Loading companies…" />;
    if (error) return <ErrorBanner message={error} />;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">Subscribed Companies</h2>
                    <p className="text-slate-400 text-sm mt-0.5">
                        <span className="text-indigo-400 font-semibold">{companies.length}</span> {companies.length === 1 ? 'company' : 'companies'} using EZ Compliance
                    </p>
                </div>
            </div>

            {companies.length === 0 ? (
                <EmptyState message="No companies have signed up yet." />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-700">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                                {['Company Name', 'Industry', 'HQ State', 'Employees', 'Plan', 'Joined'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {companies.map((c) => (
                                <tr key={c.company_id} className="bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-white">{c.company_name}</td>
                                    <td className="px-5 py-3.5 text-slate-300">{c.industry_type?.join(', ') ?? '—'}</td>
                                    <td className="px-5 py-3.5 text-slate-300">{c.hq_state ?? '—'}</td>
                                    <td className="px-5 py-3.5 text-slate-300">{c.employee_count ?? '—'}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border
                      ${c.subscription === 'Enterprise'
                                                ? 'bg-amber-900/50 text-amber-300 border-amber-700'
                                                : 'bg-slate-700 text-slate-300 border-slate-600'}`}
                                        >
                                            {c.subscription ?? '—'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-slate-400">
                                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Manage Rules Tab ──────────────────────────────────────────────────
function ManageRulesTab() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState({ open: false, data: null }); // null = add, obj = edit
    const [deleteId, setDeleteId] = useState(null);
    const [actionError, setActionError] = useState('');

    const fetchRules = useCallback(() => {
        setLoading(true);
        api.get('/developer/rules')
            .then(r => setRules(r.data))
            .catch(() => setError('Failed to load rules.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleSubmit = async (formData) => {
        setActionError('');
        try {
            if (modal.data) {
                await api.put(`/developer/rules/${modal.data.rule_id}`, formData);
            } else {
                await api.post('/developer/rules', formData);
            }
            setModal({ open: false, data: null });
            fetchRules();
        } catch (err) {
            setActionError(err.response?.data?.detail ?? 'Save failed. Please try again.');
        }
    };

    const handleDelete = async (id) => {
        setActionError('');
        try {
            await api.delete(`/developer/rules/${id}`);
            setDeleteId(null);
            fetchRules();
        } catch (err) {
            setActionError(err.response?.data?.detail ?? 'Delete failed.');
            setDeleteId(null);
        }
    };

    const freqLabel = (m) => ({ 1: 'Monthly', 3: 'Quarterly', 6: 'Half-Yearly', 12: 'Annual' }[m] ?? `${m}m`);

    if (loading) return <LoadingSpinner label="Loading rules…" />;
    if (error) return <ErrorBanner message={error} />;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">Compliance Rules</h2>
                    <p className="text-slate-400 text-sm mt-0.5">
                        <span className="text-indigo-400 font-semibold">{rules.length}</span> active rules in database
                    </p>
                </div>
                <button
                    onClick={() => setModal({ open: true, data: null })}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl
            text-sm font-semibold transition-colors shadow-md"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Rule
                </button>
            </div>

            {actionError && <ErrorBanner message={actionError} className="mb-4" />}

            {rules.length === 0 ? (
                <EmptyState message="No active rules yet. Add your first rule." />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-700">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                                {['Rule Name', 'Industries', 'States', 'Frequency', 'Penalty', 'Impact', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {rules.map((r) => (
                                <tr key={r.rule_id} className="bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white max-w-[200px]">
                                        <p className="truncate" title={r.rule_name}>{r.rule_name}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">{r.industry_type?.join(', ')}</td>
                                    <td className="px-4 py-3 text-slate-300 max-w-[140px]">
                                        <p className="truncate" title={r.applicable_states?.join(', ')}>{r.applicable_states?.join(', ')}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">{freqLabel(r.frequency_months)}</td>
                                    <td className="px-4 py-3 text-slate-300 max-w-[140px]">
                                        <p className="truncate" title={r.penalty_amount}>{r.penalty_amount ?? '—'}</p>
                                    </td>
                                    <td className="px-4 py-3"><ImpactBadge impact={r.penalty_impact} /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {/* Edit */}
                                            <button
                                                onClick={() => setModal({ open: true, data: r })}
                                                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            {/* Delete */}
                                            <button
                                                onClick={() => setDeleteId(r.rule_id)}
                                                className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 transition-colors"
                                                title="Deactivate"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Rule add/edit modal */}
            <RuleModal
                isOpen={modal.open}
                onClose={() => setModal({ open: false, data: null })}
                onSubmit={handleSubmit}
                initialData={modal.data}
            />

            {/* Delete confirm dialog */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
                    <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Deactivate Rule?</h3>
                                <p className="text-slate-400 text-xs">This will soft-delete rule #{deleteId}</p>
                            </div>
                        </div>
                        <p className="text-slate-300 text-sm mb-6">
                            The rule will be hidden from all future company matching but historical records are preserved.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => handleDelete(deleteId)}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                                Deactivate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Shared micro-components ───────────────────────────────────────────
function LoadingSpinner({ label }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">{label}</span>
        </div>
    );
}

function ErrorBanner({ message, className = '' }) {
    return (
        <div className={`flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 ${className}`}>
            <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-400 text-sm">{message}</p>
        </div>
    );
}

function EmptyState({ message }) {
    return (
        <div className="text-center py-20 text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
            <p className="text-sm">{message}</p>
        </div>
    );
}

// ── Main Layout ───────────────────────────────────────────────────────
export default function DeveloperDashboard() {
    const [activeTab, setActiveTab] = useState('companies');
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    return (
        <div className="flex min-h-screen bg-slate-900 text-white">

            {/* Sidebar */}
            <aside className="w-60 shrink-0 bg-slate-800/60 border-r border-slate-700 flex flex-col">
                {/* Logo */}
                <div className="px-6 py-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm leading-tight">EZ Compliance</p>
                            <p className="text-xs text-indigo-400">Developer Panel</p>
                        </div>
                    </div>
                </div>

                {/* Nav items */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {NAV.map(({ id, label, icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${activeTab === id
                                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Logout */}
                <div className="px-3 py-4 border-t border-slate-700">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-8">
                {activeTab === 'companies' && <CompaniesTab />}
                {activeTab === 'rules' && <ManageRulesTab />}
            </main>
        </div>
    );
}
