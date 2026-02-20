/**
 * UploadModal.jsx
 * Document upload + OCR verification modal for the Company Dashboard.
 *
 * Props:
 *   calendarId  — compliance_calendar.calendar_id
 *   ruleName    — displayed as the modal heading
 *   onClose()   — called when user closes (no result yet)
 *   onSuccess() — called after modal closes following a result; triggers dashboard refresh
 */

import { useState, useRef } from 'react';
import api from '../api/axiosInstance';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function UploadModal({ calendarId, ruleName, isReupload = false, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);   // API response or null
    const [apiError, setApiError] = useState('');
    const inputRef = useRef(null);

    if (!calendarId) return null;

    // ── File selection with size guard ─────────────────────────────────
    const handleFileChange = (e) => {
        const chosen = e.target.files?.[0];
        if (!chosen) return;
        if (chosen.size > MAX_FILE_BYTES) {
            setFileError('File is too large. Maximum allowed size is 5 MB.');
            setFile(null);
            e.target.value = '';
            return;
        }
        setFileError('');
        setApiError('');
        setFile(chosen);
    };

    // ── Upload + OCR ───────────────────────────────────────────────────
    const handleUpload = async () => {
        if (!file) { setFileError('Please select a file before uploading.'); return; }
        setApiError('');
        setLoading(true);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await api.post(`/compliance/upload/${calendarId}`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data);
        } catch (err) {
            setApiError(err.response?.data?.detail ?? 'Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Close and notify parent to refresh
    const handleClose = () => {
        if (result) onSuccess?.();
        else onClose?.();
    };

    // ── Result box variants ────────────────────────────────────────────
    const ResultBox = () => {
        if (!result) return null;
        const { status, issue_date, effective_expiry, next_due_date, ocr_result } = result;

        if (status === 'COMPLETED') {
            return (
                <div className="rounded-2xl border border-emerald-600/40 bg-emerald-900/20 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <p className="text-emerald-300 font-semibold text-base">Document Verified Successfully</p>
                    </div>
                    {issue_date && (
                        <p className="text-slate-300 text-sm">
                            Issue date: <span className="text-white font-medium">{issue_date}</span>
                        </p>
                    )}
                    {effective_expiry && (
                        <p className="text-slate-300 text-sm">
                            Effective expiry: <span className="text-white font-medium">{effective_expiry}</span>
                        </p>
                    )}
                    {next_due_date && (
                        <p className="text-slate-300 text-sm pt-1 border-t border-emerald-700/30">
                            Next due date: <span className="text-white font-medium">{next_due_date}</span>
                        </p>
                    )}
                </div>
            );
        }

        if (status === 'OVERDUE-PASS') {
            return (
                <div className="rounded-2xl border border-amber-600/40 bg-amber-900/20 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🟡</span>
                        <p className="text-amber-300 font-semibold text-base">Document valid but uploaded after due date</p>
                    </div>
                    {issue_date && (
                        <p className="text-slate-300 text-sm">
                            Issue date: <span className="text-white font-medium">{issue_date}</span>
                        </p>
                    )}
                    {effective_expiry && (
                        <p className="text-slate-300 text-sm">
                            Effective expiry: <span className="text-white font-medium">{effective_expiry}</span>
                        </p>
                    )}
                    {next_due_date && (
                        <p className="text-slate-300 text-sm pt-1 border-t border-amber-700/30">
                            Next due date: <span className="text-white font-medium">{next_due_date}</span>
                        </p>
                    )}
                </div>
            );
        }

        if (status === 'FAILED') {
            return (
                <div className="rounded-2xl border border-red-600/40 bg-red-900/20 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">❌</span>
                        <p className="text-red-300 font-semibold text-base">Verification Failed</p>
                    </div>
                    {issue_date && effective_expiry && (
                        <p className="text-slate-300 text-sm">
                            Issue date: <span className="text-white font-medium">{issue_date}</span>
                            {' · '}Expired on: <span className="text-red-300 font-medium">{effective_expiry}</span>
                        </p>
                    )}
                    <p className="text-slate-400 text-sm">{ocr_result}</p>
                </div>
            );
        }

        // Fallback
        return (
            <div className="rounded-2xl border border-slate-600 bg-slate-800 p-4 text-slate-300 text-sm">
                Status: <span className="font-medium text-white">{status}</span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : handleClose} />

            {/* Panel */}
            <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-slate-700 gap-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-white">
                            {isReupload ? 'Re-upload Compliance Document' : 'Upload Compliance Document'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2" title={ruleName}>
                            {ruleName}
                        </p>
                    </div>
                    {!loading && (
                        <button onClick={handleClose}
                            className="shrink-0 text-slate-400 hover:text-white transition-colors mt-0.5">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">

                    {/* Re-upload notice banner */}
                    {isReupload && !result && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-amber-600/40 bg-amber-900/20 px-4 py-3">
                            <span className="text-amber-400 text-base mt-0.5">🔄</span>
                            <p className="text-amber-300 text-xs leading-relaxed">
                                You are re-uploading a document for a <span className="font-semibold">completed</span> rule.
                                The <span className="font-semibold">Due Date</span> will be updated based on the new document's dates.
                            </p>
                        </div>
                    )}

                    {/* File picker — always visible so user can re-upload if FAILED */}
                    {!result || result.status === 'FAILED' ? (
                        <>
                            {/* Drop zone */}
                            <div>
                                <label
                                    className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed
                    rounded-2xl cursor-pointer transition-colors select-none
                    ${file
                                            ? 'border-indigo-500 bg-indigo-600/10'
                                            : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}
                                    onClick={() => !loading && inputRef.current?.click()}
                                >
                                    <svg className={`w-8 h-8 mb-2 ${file ? 'text-indigo-400' : 'text-slate-500'}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    {file ? (
                                        <span className="text-sm text-indigo-400 font-medium px-4 text-center truncate max-w-full">
                                            {file.name}
                                        </span>
                                    ) : (
                                        <>
                                            <span className="text-sm text-slate-400">Click to browse</span>
                                            <span className="text-xs text-slate-500 mt-0.5">PDF, PNG, JPG, JPEG · max 5 MB</span>
                                        </>
                                    )}
                                    <input
                                        ref={inputRef}
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={loading}
                                    />
                                </label>

                                {fileError && (
                                    <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        {fileError}
                                    </p>
                                )}
                            </div>

                            {/* API error */}
                            {apiError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                                    {apiError}
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-1">
                                <button onClick={handleClose} disabled={loading}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleUpload} disabled={loading || !file}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                                    {loading ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Running OCR…
                                        </>
                                    ) : (
                                        'Upload & Verify'
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* Result view — COMPLETED or OVERDUE-PASS */
                        <>
                            <ResultBox />
                            <button onClick={handleClose}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                                Close
                            </button>
                        </>
                    )}

                    {/* Inline result for FAILED status (shown above file picker so user can re-upload) */}
                    {result?.status === 'FAILED' && (
                        <ResultBox />
                    )}
                </div>
            </div>
        </div>
    );
}
