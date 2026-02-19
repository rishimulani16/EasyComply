/**
 * CompanyDashboard.jsx
 * Company Admin compliance dashboard — summary stat cards + calendar table.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import UploadModal from '../components/UploadModal';
import MarkDoneModal from '../components/MarkDoneModal';

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = {
        COMPLETED: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
        PENDING: 'bg-yellow-900/60  text-yellow-300  border-yellow-700',
        OVERDUE: 'bg-red-900/60     text-red-300     border-red-700',
        'OVERDUE-PASS': 'bg-amber-900/60 text-amber-300   border-amber-700',
        FAILED: 'bg-red-900/60     text-red-300     border-red-700',
    };
    const icons = {
        COMPLETED: '✅', PENDING: '⏳', OVERDUE: '❌', 'OVERDUE-PASS': '🟡', FAILED: '❌',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${cfg[status] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
            <span>{icons[status] ?? '—'}</span>
            {status}
        </span>
    );
}

// ── Frequency label ──────────────────────────────────────────────────────
const freqLabel = (m) => ({ 1: 'Monthly', 3: 'Quarterly', 6: 'Half-Yearly', 12: 'Annual' }[m] ?? `${m}m`);

// ── Safe local-date parser (avoids UTC-midnight off-by-one in IST +5:30) ──
// Backend sends plain ISO dates like "2026-03-01". When passed directly to
// new Date(), JS parses them as UTC midnight, which becomes 23 Feb in IST.
// Appending T00:00:00 forces local-midnight parsing.
const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr + 'T00:00:00').toLocaleDateString('en-IN');
};

// Days until a date string (negative = overdue)
const daysUntil = (isoStr) => {
    if (!isoStr) return Infinity;
    const d = new Date(isoStr + 'T00:00:00');
    return (d - new Date()) / 86400000;
};

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, colorClass, icon }) {
    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colorClass} bg-opacity-20`}>
                {icon}
            </div>
            <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
            </div>
        </div>
    );
}

export default function CompanyDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploadModal, setUploadModal] = useState({ open: false, calendarId: null, ruleName: '' });
    const [markDoneModal, setMarkDoneModal] = useState({ open: false, calendarId: null, ruleName: '' });
    const [actionError, setActionError] = useState('');

    const fetchDashboard = useCallback(() => {
        setLoading(true);
        api.get('/company/dashboard')
            .then(r => setData(r.data))
            .catch(() => setError('Failed to load compliance data.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    // ── Loading / error states ──────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 gap-3">
                <svg className="w-6 h-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading compliance data…
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={fetchDashboard} className="text-indigo-400 hover:underline text-sm">Retry</button>
                </div>
            </div>
        );
    }

    const { summary, rules } = data ?? { summary: {}, rules: [] };

    return (
        <div className="min-h-screen bg-slate-900 text-white">

            {/* Top nav */}
            <nav className="border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                        </svg>
                    </div>
                    <span className="font-bold text-lg">EZ Compliance — Company Dashboard</span>
                </div>
                <button onClick={handleLogout}
                    className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                </button>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">

                {/* Summary stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard label="Total Rules" value={summary.total ?? 0} icon="📋" colorClass="text-blue-400" />
                    <StatCard label="Completed" value={summary.completed ?? 0} icon="✅" colorClass="text-emerald-400" />
                    <StatCard label="Pending" value={summary.pending ?? 0} icon="⏳" colorClass="text-yellow-400" />
                    <StatCard label="Overdue" value={summary.overdue ?? 0} icon="❌" colorClass="text-red-400" />
                </div>

                {actionError && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                        {actionError}
                    </div>
                )}

                {/* Compliance table */}
                <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                        <h2 className="font-bold text-white">Compliance Calendar</h2>
                        <span className="text-xs text-slate-400">Sorted by nearest due date</span>
                    </div>

                    {rules.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <p className="text-lg mb-1">No compliance rules yet</p>
                            <p className="text-sm">Rules will appear here after company onboarding.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-xs uppercase tracking-wider bg-slate-800/60">
                                        {['Rule Name', 'Frequency', 'Due Date', 'Scope', 'Status', 'Action'].map(h => (
                                            <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/40">
                                    {rules.map((row) => {
                                        const isOverdue = row.status === 'OVERDUE' || row.status === 'FAILED';
                                        const isDue7Days = row.due_date && !isOverdue && daysUntil(row.due_date) < 7;

                                        return (
                                            <tr key={row.calendar_id}
                                                className={`transition-colors hover:bg-slate-800/50
                          ${isOverdue ? 'bg-red-900/10' : isDue7Days ? 'bg-yellow-900/10' : ''}`}
                                            >
                                                {/* Rule name */}
                                                <td className="px-5 py-4">
                                                    <p className="font-medium text-white max-w-[220px] truncate" title={row.rule_name}>
                                                        {row.rule_name}
                                                    </p>
                                                    {row.document_required && (
                                                        <span className="text-xs text-slate-500 mt-0.5 inline-block">Document required</span>
                                                    )}
                                                </td>

                                                {/* Frequency */}
                                                <td className="px-5 py-4 text-slate-300">{freqLabel(row.frequency_months)}</td>

                                                {/* Due date */}
                                                <td className="px-5 py-4">
                                                    <span className={`font-medium ${isOverdue ? 'text-red-400' : isDue7Days ? 'text-yellow-400' : 'text-slate-300'}`}>
                                                        {formatDate(row.due_date)}
                                                    </span>
                                                </td>

                                                {/* Scope */}
                                                <td className="px-5 py-4">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${row.scope === 'Branch'
                                                            ? 'bg-purple-900/50 text-purple-300 border-purple-700'
                                                            : 'bg-slate-700 text-slate-300 border-slate-600'}`}
                                                    >
                                                        {row.scope ?? 'Company'}
                                                    </span>
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-4"><StatusBadge status={row.status} /></td>

                                                {/* Action */}
                                                <td className="px-5 py-4">
                                                    {row.status === 'COMPLETED' || row.status === 'OVERDUE-PASS' ? (
                                                        <span className="text-slate-500 text-xs">Done</span>
                                                    ) : row.document_required ? (
                                                        <button
                                                            onClick={() => setUploadModal({ open: true, calendarId: row.calendar_id, ruleName: row.rule_name })}
                                                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-600/50
                                text-indigo-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                            </svg>
                                                            Upload
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setMarkDoneModal({ open: true, calendarId: row.calendar_id, ruleName: row.rule_name })}
                                                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/50
                                text-emerald-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Mark Done
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Upload modal */}
            {uploadModal.open && (
                <UploadModal
                    calendarId={uploadModal.calendarId}
                    ruleName={uploadModal.ruleName}
                    onClose={() => setUploadModal({ open: false, calendarId: null, ruleName: '' })}
                    onSuccess={() => {
                        setUploadModal({ open: false, calendarId: null, ruleName: '' });
                        fetchDashboard();
                    }}
                />
            )}

            {/* Mark Done modal */}
            {markDoneModal.open && (
                <MarkDoneModal
                    calendarId={markDoneModal.calendarId}
                    ruleName={markDoneModal.ruleName}
                    onClose={() => setMarkDoneModal({ open: false, calendarId: null, ruleName: '' })}
                    onSuccess={() => {
                        setMarkDoneModal({ open: false, calendarId: null, ruleName: '' });
                        fetchDashboard();
                    }}
                />
            )}
        </div>
    );
}
