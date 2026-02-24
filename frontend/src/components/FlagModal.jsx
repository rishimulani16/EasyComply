/**
 * FlagModal.jsx
 * Auditor-only modal to flag a compliance document as suspicious.
 */

import { useState } from 'react';
import api from '../api/axiosInstance';

export default function FlagModal({ docId, fileName, version, uploadedAt, onClose, onSuccess }) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!reason.trim()) { setError('Please provide a reason for flagging.'); return; }
        setLoading(true);
        setError('');
        try {
            await api.post(`/audit/flag/${docId}`, { reason: reason.trim() });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to submit flag. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-red-900/30 border-b border-red-800/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🚩</span>
                        <div>
                            <h2 className="font-bold text-white text-base">Flag Document</h2>
                            <p className="text-xs text-red-300 mt-0.5">Mark as suspicious for review</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Document info */}
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/60">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-slate-500 text-xs uppercase tracking-wide">Document</p>
                            <p className="text-slate-200 font-medium truncate mt-0.5" title={fileName}>{fileName || '—'}</p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-xs uppercase tracking-wide">Version</p>
                            <p className="text-slate-200 font-medium mt-0.5">v{version}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-slate-500 text-xs uppercase tracking-wide">Uploaded</p>
                            <p className="text-slate-200 font-medium mt-0.5">
                                {uploadedAt ? new Date(uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reason input */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            Reason for flagging <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe why this document appears suspicious (e.g. incorrect dates, missing information, potential forgery...)"
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm resize-none
                                focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                        />
                        <p className="text-xs text-slate-500 mt-1">{reason.length}/500 characters</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !reason.trim()}
                            className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed
                                text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Submitting…
                                </>
                            ) : '🚩 Submit Flag'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
