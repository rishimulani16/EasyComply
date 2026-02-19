/**
 * UploadModal.jsx
 * Document upload modal — triggered from CompanyDashboard action column.
 * POSTs multipart/form-data to POST /compliance/upload/{calendar_id}
 */

import { useState } from 'react';
import api from '../api/axiosInstance';

export default function UploadModal({ calendarId, ruleName, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);   // OCR result from API
    const [error, setError] = useState('');

    if (!calendarId) return null;

    const handleUpload = async () => {
        if (!file) { setError('Please select a file first.'); return; }
        setError('');
        setLoading(true);
        const form = new FormData();
        form.append('file', file);
        try {
            const res = await api.post(`/compliance/upload/${calendarId}`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data);
            onSuccess?.();
        } catch (err) {
            setError(err.response?.data?.detail ?? 'Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const statusColors = {
        COMPLETED: 'text-emerald-400',
        'OVERDUE-PASS': 'text-amber-400',
        FAILED: 'text-red-400',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div>
                        <h2 className="text-base font-bold text-white">Upload Document</h2>
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">{ruleName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {!result ? (
                        <>
                            {/* Drop zone */}
                            <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors
                ${file ? 'border-indigo-500 bg-indigo-600/10' : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                {file
                                    ? <span className="text-sm text-indigo-400 font-medium">{file.name}</span>
                                    : <span className="text-sm text-slate-400">PDF or image — click to browse</span>
                                }
                                <input type="file" accept=".pdf,image/*" className="hidden"
                                    onChange={(e) => { setFile(e.target.files[0]); setError(''); }} />
                            </label>

                            {error && (
                                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">{error}</p>
                            )}

                            <div className="flex gap-3">
                                <button onClick={onClose}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleUpload} disabled={loading || !file}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                                    {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>}
                                    {loading ? 'Processing OCR…' : 'Upload & Verify'}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* OCR Result */
                        <div className="space-y-4">
                            <div className="text-center">
                                <span className={`text-2xl font-bold ${statusColors[result.status] ?? 'text-white'}`}>
                                    {result.status}
                                </span>
                            </div>
                            <div className="bg-slate-900 rounded-xl px-4 py-3 text-sm text-slate-300 leading-relaxed">
                                {result.ocr_result}
                            </div>
                            {result.next_due_date && (
                                <p className="text-sm text-slate-400 text-center">
                                    Next due: <span className="text-white font-medium">{result.next_due_date}</span>
                                </p>
                            )}
                            <button onClick={onClose}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
