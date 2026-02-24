/**
 * AuditorDashboard.jsx
 * Read-only compliance dashboard for Auditors.
 * - Same data as CompanyDashboard but no Upload / Mark Done buttons
 * - 🚩 Flag button to raise concerns on compliance entries
 * - Live flags panel at the bottom
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import FlagModal from '../components/FlagModal';

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = {
        COMPLETED: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
        PENDING: 'bg-yellow-900/60 text-yellow-300 border-yellow-700',
        'OVERDUE-PASS': 'bg-amber-900/60 text-amber-300 border-amber-700',
        FAILED: 'bg-red-900/60 text-red-300 border-red-700',
    };
    const icons = { COMPLETED: '✅', PENDING: '⏳', 'OVERDUE-PASS': '🟡', FAILED: '❌' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${cfg[status] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
            <span>{icons[status] ?? '—'}</span>{status}
        </span>
    );
}

const freqLabel = (m) => ({ 1: 'Monthly', 3: 'Quarterly', 6: 'Half-Yearly', 12: 'Annual' }[m] ?? `${m}m`);
const formatDate = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN') : '—';

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, colorClass, icon }) {
    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colorClass}`}>{icon}</div>
            <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-3xl font-bold mt-0.5 ${colorClass}`}>{value}</p>
            </div>
        </div>
    );
}

// ── Compliance Score Ring ─────────────────────────────────────────────────
function ScoreRing({ score }) {
    const radius = 54, stroke = 8;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    let ringColor, textColor, label;
    if (score >= 75) { ringColor = '#10b981'; textColor = 'text-emerald-400'; label = 'Good Standing'; }
    else if (score >= 40) { ringColor = '#f59e0b'; textColor = 'text-yellow-400'; label = 'Needs Attention'; }
    else { ringColor = '#ef4444'; textColor = 'text-red-400'; label = 'Critical'; }
    return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Compliance Score</p>
            <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r={radius} fill="none" stroke="#334155" strokeWidth={stroke} />
                    <circle cx="64" cy="64" r={radius} fill="none" stroke={ringColor} strokeWidth={stroke}
                        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${textColor}`}>{score}%</span>
                </div>
            </div>
            <span className={`text-xs font-semibold ${textColor}`}>{label}</span>
            <p className="text-[10px] text-slate-500">Read-only — Auditor view</p>
        </div>
    );
}

export default function AuditorDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [flagModal, setFlagModal] = useState({ open: false, docId: null, calendarId: null, ruleName: '', version: 1, fileName: '', uploadedAt: null });
    const [sortBy, setSortBy] = useState('renewalDate');

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            api.get('/audit/dashboard'),
            api.get('/audit/flags'),
        ])
            .then(([dashRes, flagRes]) => {
                setData(dashRes.data);
                setFlags(flagRes.data);
            })
            .catch(() => setError('Failed to load auditor data.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleLogout = () => { localStorage.removeItem('token'); navigate('/'); };

    // ── Sort ───────────────────────────────────────────────────────────
    const IMPACT_ORDER = { Imprisonment: 0, High: 1, Medium: 2, Low: 3 };
    const sortRows = (rows) => {
        const copy = [...rows];
        if (sortBy === 'penaltyImpact') {
            copy.sort((a, b) => (IMPACT_ORDER[a.penalty_impact] ?? 4) - (IMPACT_ORDER[b.penalty_impact] ?? 4));
        } else {
            copy.sort((a, b) => {
                const aD = a.due_date ? new Date(a.due_date + 'T00:00:00').getTime() : Infinity;
                const bD = b.due_date ? new Date(b.due_date + 'T00:00:00').getTime() : Infinity;
                return aD - bD;
            });
        }
        return copy;
    };

    const SortBar = () => (
        <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-1.5 border border-slate-700">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span className="text-xs text-slate-500 font-medium">Sort:</span>
            <div className="relative flex items-center">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-transparent text-xs font-semibold text-slate-200 cursor-pointer outline-none pr-5">
                    <option value="renewalDate" className="bg-slate-800">Renewal Date</option>
                    <option value="penaltyImpact" className="bg-slate-800">Penalty Impact</option>
                </select>
                <svg className="w-3 h-3 text-slate-400 pointer-events-none absolute right-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 gap-3">
                <svg className="w-6 h-6 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading auditor view…
            </div>
        );
    }
    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={fetchAll} className="text-violet-400 hover:underline text-sm">Retry</button>
                </div>
            </div>
        );
    }

    const { summary, rules } = data ?? { summary: {}, rules: [] };
    const unresolvedFlags = flags.filter(f => !f.resolved);

    // Grouping — identical logic to CompanyDashboard
    const byState = {};
    const companyWide = [];
    rules.forEach(row => {
        if (row.scope === 'Branch') {
            const state = row.branch_state ?? 'Unknown';
            if (!byState[state]) byState[state] = [];
            byState[state].push(row);
        } else {
            const states = (row.applicable_states ?? []).filter(s => s !== 'ALL');
            if (states.length === 1) {
                const state = states[0];
                if (!byState[state]) byState[state] = [];
                byState[state].push(row);
            } else {
                companyWide.push(row);
            }
        }
    });

    const stateColors = [
        { bg: 'bg-indigo-600/10', border: 'border-indigo-600/40', text: 'text-indigo-300', badge: 'bg-indigo-900/60 border-indigo-700 text-indigo-300' },
        { bg: 'bg-purple-600/10', border: 'border-purple-600/40', text: 'text-purple-300', badge: 'bg-purple-900/60 border-purple-700 text-purple-300' },
        { bg: 'bg-cyan-600/10', border: 'border-cyan-600/40', text: 'text-cyan-300', badge: 'bg-cyan-900/60 border-cyan-700 text-cyan-300' },
        { bg: 'bg-teal-600/10', border: 'border-teal-600/40', text: 'text-teal-300', badge: 'bg-teal-900/60 border-teal-700 text-teal-300' },
    ];

    // Read-only compliance table (no action buttons — just a 🚩 Flag on each row)
    const ReadOnlyTable = ({ rows }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-wider bg-slate-800/60">
                        {['Rule Name', 'Frequency', 'Renewal Date', 'Penalty Impact', 'Status', 'Flag'].map(h => (
                            <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                    {sortRows(rows).map((row) => {
                        const isFailed = row.status === 'FAILED';
                        return (
                            <tr key={row.calendar_id} className={`transition-colors hover:bg-slate-800/50 ${isFailed ? 'bg-red-900/10' : ''}`}>
                                <td className="px-5 py-4">
                                    <p className="font-medium text-white max-w-[220px] truncate" title={row.rule_name}>{row.rule_name}</p>
                                    {row.document_required && (
                                        <span className="text-xs text-slate-500 mt-0.5 inline-block">Document required</span>
                                    )}
                                </td>
                                <td className="px-5 py-4 text-slate-300">{freqLabel(row.frequency_months)}</td>
                                <td className="px-5 py-4">
                                    <span className={`font-medium ${isFailed ? 'text-red-400' : 'text-slate-300'}`}>
                                        {formatDate(row.due_date)}
                                    </span>
                                </td>
                                <td className="px-5 py-4">
                                    {(() => {
                                        const impact = row.penalty_impact;
                                        const styles = {
                                            Imprisonment: 'bg-red-900/50 text-red-300 border-red-700',
                                            High: 'bg-orange-900/50 text-orange-300 border-orange-700',
                                            Medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
                                            Low: 'bg-slate-700/50 text-slate-300 border-slate-600',
                                        };
                                        return impact ? (
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${styles[impact] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                                {impact}
                                            </span>
                                        ) : <span className="text-slate-500">—</span>;
                                    })()}
                                </td>
                                <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                                <td className="px-5 py-4">
                                    <button
                                        onClick={() => setFlagModal({
                                            open: true,
                                            docId: row.calendar_id,   // using calendar_id as proxy until compliance_documents is live
                                            calendarId: row.calendar_id,
                                            ruleName: row.rule_name,
                                            version: 1,
                                            fileName: row.rule_name,
                                            uploadedAt: row.verified_at,
                                        })}
                                        className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        🚩 Flag
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-white">

            {/* Nav */}
            <nav className="border-b border-violet-900/40 px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                        </svg>
                    </div>
                    <div>
                        <span className="font-bold text-lg">EZ Compliance — Auditor View</span>
                        <span className="ml-3 text-xs bg-violet-900/50 text-violet-300 border border-violet-700 px-2 py-0.5 rounded-full font-medium">Read Only</span>
                    </div>
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

                {/* Unresolved flags banner */}
                {unresolvedFlags.length > 0 && (
                    <div className="mb-6 bg-red-900/20 border border-red-800/40 rounded-2xl px-5 py-4 flex items-center gap-3">
                        <span className="text-xl">🚩</span>
                        <div>
                            <p className="text-red-300 font-semibold text-sm">
                                {unresolvedFlags.length} unresolved flag{unresolvedFlags.length > 1 ? 's' : ''} raised
                            </p>
                            <p className="text-red-400/70 text-xs mt-0.5">Scroll to the Audit Flags section below to review</p>
                        </div>
                    </div>
                )}

                {/* Summary */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <ScoreRing score={summary.compliance_score ?? 0} />
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        <StatCard label="Total Rules" value={summary.total ?? 0} icon="📋" colorClass="text-blue-400" />
                        <StatCard label="Completed" value={summary.completed ?? 0} icon="✅" colorClass="text-emerald-400" />
                        <StatCard label="Pending" value={summary.pending ?? 0} icon="⏳" colorClass="text-yellow-400" />
                        <StatCard label="Failed" value={summary.failed ?? 0} icon="❌" colorClass="text-red-400" />
                    </div>
                </div>

                {/* Compliance panels */}
                {rules.length === 0 ? (
                    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl text-center py-16 text-slate-500">
                        <p className="text-lg">No compliance rules found for this company.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Per-state panels */}
                        {Object.entries(byState).map(([state, rows], idx) => {
                            const col = stateColors[idx % stateColors.length];
                            const done = rows.filter(r => r.status === 'COMPLETED' || r.status === 'OVERDUE-PASS').length;
                            return (
                                <div key={state} className={`rounded-2xl border ${col.border} overflow-hidden`}>
                                    <div className={`px-5 py-4 ${col.bg} border-b ${col.border} flex items-center justify-between`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">📍</span>
                                            <div>
                                                <h2 className={`font-bold text-base ${col.text}`}>{state}</h2>
                                                <p className="text-xs text-slate-400 mt-0.5">Location-specific compliance rules</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <SortBar />
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${col.badge}`}>
                                                {done}/{rows.length} completed
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/40"><ReadOnlyTable rows={rows} /></div>
                                </div>
                            );
                        })}

                        {/* Company-wide panel */}
                        {companyWide.length > 0 && (
                            <div className="rounded-2xl border border-slate-600/50 overflow-hidden">
                                <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">🏢</span>
                                        <div>
                                            <h2 className="font-bold text-base text-slate-200">Company-wide Rules</h2>
                                            <p className="text-xs text-slate-400 mt-0.5">Same document valid across all locations</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <SortBar />
                                        <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-700 border-slate-600 text-slate-300">
                                            {companyWide.filter(r => r.status === 'COMPLETED' || r.status === 'OVERDUE-PASS').length}/{companyWide.length} completed
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-slate-800/40"><ReadOnlyTable rows={companyWide} /></div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Audit Flags Section ──────────────────────────────────────── */}
                <div className="mt-10">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xl">🚩</span>
                        <h2 className="text-lg font-bold text-slate-200">Audit Flags</h2>
                        {unresolvedFlags.length > 0 && (
                            <span className="text-xs bg-red-900/50 text-red-300 border border-red-700 px-2 py-0.5 rounded-full font-medium">
                                {unresolvedFlags.length} open
                            </span>
                        )}
                    </div>

                    {flags.length === 0 ? (
                        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl text-center py-10 text-slate-500">
                            <p>No flags raised yet. Use the 🚩 Flag button on any rule row above.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {flags.map(flag => (
                                <div key={flag.flag_id}
                                    className={`rounded-xl border px-5 py-4 flex items-start justify-between gap-4 ${flag.resolved ? 'border-slate-700 bg-slate-800/30' : 'border-red-800/40 bg-red-900/10'}`}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${flag.resolved ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-red-900/40 text-red-300 border-red-700'}`}>
                                                {flag.resolved ? '✅ Resolved' : '🚩 Open'}
                                            </span>
                                            <span className="text-xs text-slate-500">Flag #{flag.flag_id} · Doc #{flag.doc_id}</span>
                                            <span className="text-xs text-slate-500">by {flag.flagged_by}</span>
                                        </div>
                                        <p className="text-slate-200 text-sm mt-2 font-medium">{flag.reason}</p>
                                        <p className="text-slate-500 text-xs mt-1">
                                            Raised: {flag.flagged_at ? new Date(flag.flagged_at).toLocaleString('en-IN') : '—'}
                                            {flag.resolved && flag.resolved_by && (
                                                <> · Resolved by {flag.resolved_by}</>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Flag modal */}
            {flagModal.open && (
                <FlagModal
                    docId={flagModal.docId}
                    fileName={flagModal.fileName}
                    version={flagModal.version}
                    uploadedAt={flagModal.uploadedAt}
                    onClose={() => setFlagModal({ open: false, docId: null, calendarId: null, ruleName: '', version: 1, fileName: '', uploadedAt: null })}
                    onSuccess={() => {
                        setFlagModal({ open: false, docId: null, calendarId: null, ruleName: '', version: 1, fileName: '', uploadedAt: null });
                        fetchAll();
                    }}
                />
            )}
        </div>
    );
}
