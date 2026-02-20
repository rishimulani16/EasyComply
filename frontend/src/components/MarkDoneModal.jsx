/**
 * MarkDoneModal.jsx
 * Modal for non-document compliance rules.
 * Collects: compliance note, renewal/certificate date, and
 * an optional expiry date (with a "Permanent / No Expiry" toggle).
 *
 * Props:
 *   calendarId  — compliance_calendar.calendar_id
 *   ruleName    — displayed as the modal heading
 *   onClose()   — called when user cancels (no change)
 *   onSuccess() — called after successful submission; triggers dashboard refresh
 */

import { useState } from 'react';
import api from '../api/axiosInstance';

export default function MarkDoneModal({ calendarId, ruleName, isRedo = false, onClose, onSuccess }) {
    const [note, setNote] = useState('');
    const [renewalDate, setRenewalDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [useCustomExpiry, setUseCustomExpiry] = useState(false);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState('');
    const [result, setResult] = useState(null);

    if (!calendarId) return null;

    const today = new Date().toISOString().split('T')[0];

    // ── Submit ─────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!note.trim()) {
            setApiError('Please enter a compliance note or reference.');
            return;
        }
        if (!renewalDate) {
            setApiError('Please enter the renewal / certificate date.');
            return;
        }
        setApiError('');
        setLoading(true);
        try {
            const payload = {
                note: note.trim(),
                renewal_date: renewalDate,
                expiry_date: useCustomExpiry ? (expiryDate || null) : null,
            };
            const res = await api.patch(`/compliance/markdone/${calendarId}`, payload);
            setResult(res.data);
        } catch (err) {
            setApiError(err.response?.data?.detail ?? 'Could not mark as done. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (result) onSuccess?.();
        else onClose?.();
    };

    // ── Icons ──────────────────────────────────────────────────────────
    const CheckIcon = () => (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    );
    const SpinIcon = () => (
        <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={loading ? undefined : handleClose}
            />

            {/* Panel */}
            <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-slate-700 gap-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-white">
                            {isRedo ? 'Update Compliance Record' : 'Mark as Completed'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2" title={ruleName}>
                            {ruleName}
                        </p>
                    </div>
                    {!loading && (
                        <button
                            onClick={handleClose}
                            className="shrink-0 text-slate-400 hover:text-white transition-colors mt-0.5"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {!result ? (
                        <>
                            {/* Re-do notice banner */}
                            {isRedo && (
                                <div className="flex items-start gap-2.5 rounded-xl border border-violet-600/40 bg-violet-900/20 px-4 py-3">
                                    <span className="text-violet-400 text-base mt-0.5">✏️</span>
                                    <p className="text-violet-300 text-xs leading-relaxed">
                                        You are updating a <span className="font-semibold">completed</span> rule.
                                        The new dates will overwrite the previous entry and update the <span className="font-semibold">Due Date</span>.
                                    </p>
                                </div>
                            )}
                            {/* ── Compliance Note ───────────────────────── */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide font-medium mb-1.5">
                                    Compliance Note / Reference <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => { setNote(e.target.value); setApiError(''); }}
                                    disabled={loading}
                                    rows={2}
                                    placeholder="e.g. Filed GST return · Ref# GR-2026-02 · Submitted via portal"
                                    className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white
                                               placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                                               resize-none transition-colors disabled:opacity-50"
                                />
                            </div>

                            {/* ── Renewal / Certificate Date ────────────── */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide font-medium mb-1.5">
                                    Issue Date <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={renewalDate}
                                    max={today}
                                    onChange={(e) => { setRenewalDate(e.target.value); setApiError(''); }}
                                    disabled={loading}
                                    className="w-full bg-slate-900/70 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white
                                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                                               transition-colors disabled:opacity-50 [color-scheme:dark]"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Date the certificate or document was issued
                                </p>
                            </div>

                            {/* ── Expiry Date ───────────────────────────── */}
                            <div>
                                <label className="block text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
                                    Expiry Date
                                </label>

                                {/* Radio options */}
                                <div className="flex flex-col gap-2 mb-3">
                                    {/* Option 1: Use rule's default */}
                                    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors
                                        ${!useCustomExpiry
                                            ? 'border-indigo-500/60 bg-indigo-600/10'
                                            : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                        <input
                                            type="radio"
                                            name="expiryMode"
                                            checked={!useCustomExpiry}
                                            onChange={() => { setUseCustomExpiry(false); setExpiryDate(''); }}
                                            disabled={loading}
                                            className="accent-indigo-500 w-3.5 h-3.5 shrink-0"
                                        />
                                        <div>
                                            <p className={`text-sm font-medium ${!useCustomExpiry ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                Use rule's default
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">Next due date calculated from rule's frequency</p>
                                        </div>
                                    </label>

                                    {/* Option 2: Custom expiry date */}
                                    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors
                                        ${useCustomExpiry
                                            ? 'border-indigo-500/60 bg-indigo-600/10'
                                            : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                        <input
                                            type="radio"
                                            name="expiryMode"
                                            checked={useCustomExpiry}
                                            onChange={() => setUseCustomExpiry(true)}
                                            disabled={loading}
                                            className="accent-indigo-500 w-3.5 h-3.5 shrink-0"
                                        />
                                        <div>
                                            <p className={`text-sm font-medium ${useCustomExpiry ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                Set custom expiry date
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">Next due date calculated from your chosen expiry date</p>
                                        </div>
                                    </label>
                                </div>

                                {/* Date input — only enabled when custom is selected */}
                                <input
                                    type="date"
                                    value={expiryDate}
                                    min={renewalDate || today}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                    disabled={loading || !useCustomExpiry}
                                    className={`w-full bg-slate-900/70 border rounded-xl px-4 py-3 text-sm
                                               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                                               transition-colors [color-scheme:dark]
                                               ${!useCustomExpiry
                                            ? 'border-slate-700 text-slate-500 opacity-40 cursor-not-allowed'
                                            : 'border-slate-600 text-white'}`}
                                />
                                {useCustomExpiry && expiryDate && (
                                    <p className="text-xs text-slate-400 mt-1">Next due reminder calculated from this date</p>
                                )}
                            </div>

                            {/* ── Error ─────────────────────────────────── */}
                            {apiError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm flex items-start gap-2">
                                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {apiError}
                                </div>
                            )}

                            {/* ── Buttons ───────────────────────────────── */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={handleClose}
                                    disabled={loading}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !note.trim() || !renewalDate}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <><SpinIcon /> Saving…</> : <><CheckIcon /> Confirm & Complete</>}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* ── Success view ─────────────────────────────── */
                        <>
                            <div className="rounded-2xl border border-emerald-600/40 bg-emerald-900/20 p-5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">✅</span>
                                    <p className="text-emerald-300 font-semibold text-base">Marked as Completed</p>
                                </div>
                                {result.note && (
                                    <p className="text-slate-300 text-sm">
                                        Note: <span className="text-white">{result.note}</span>
                                    </p>
                                )}
                                {result.renewal_date && (
                                    <p className="text-slate-300 text-sm">
                                        Renewed on: <span className="text-white font-medium">{result.renewal_date}</span>
                                    </p>
                                )}
                                {result.permanent ? (
                                    <p className="text-slate-300 text-sm flex items-center gap-1">
                                        <span>♾️</span> <span className="text-emerald-400 font-medium">Permanent — no expiry</span>
                                    </p>
                                ) : result.expiry_date ? (
                                    <p className="text-slate-300 text-sm">
                                        Expiry date: <span className="text-white font-medium">{result.expiry_date}</span>
                                    </p>
                                ) : null}
                                {result.next_due_date && (
                                    <p className="text-slate-300 text-sm pt-1 border-t border-emerald-700/30">
                                        Next renewal due: <span className="text-white font-medium">{result.next_due_date}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
