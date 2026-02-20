/**
 * RuleModal.jsx
 * Shared modal for Add and Edit compliance rule.
 * Controlled entirely by parent (DeveloperDashboard).
 */

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

const INDUSTRIES = ['AI', 'IT', 'Transport', 'ALL'];
const STATES = ['Gujarat', 'Maharashtra', 'Rajasthan', 'Goa', 'ALL'];
const COMP_TYPES = ['Pvt Ltd', 'Public Ltd', 'ALL'];
const IMPACTS = ['Imprisonment', 'High', 'Medium', 'Low'];
const FREQUENCIES = [
    { label: '1 — Monthly', value: 1 },
    { label: '3 — Quarterly', value: 3 },
    { label: '6 — Half-Yearly', value: 6 },
    { label: '12 — Annual', value: 12 },
];

/** Multi-checkbox group */
function CheckboxGroup({ label, options, value = [], onChange }) {
    const toggle = (opt) => {
        if (opt === 'ALL') return onChange(['ALL']);
        const next = value.filter((v) => v !== 'ALL');
        onChange(next.includes(opt) ? next.filter((v) => v !== opt) : [...next, opt]);
    };
    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                {label}
            </label>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const checked = value.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors
                ${checked
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function RuleModal({ isOpen, onClose, onSubmit, initialData }) {
    const isEdit = !!initialData;

    const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            rule_name: '',
            description: '',
            industry_type: ['ALL'],
            applicable_states: ['ALL'],
            company_type: ['ALL'],
            min_employees: 0,
            max_employees: 999999,
            frequency_months: 12,
            document_required: false,
            penalty_amount: '',
            penalty_impact: 'Medium',
            scope: 'Company',
        },
    });

    // Pre-fill on edit
    useEffect(() => {
        if (isOpen) reset(initialData ?? {
            rule_name: '', description: '',
            industry_type: ['ALL'], applicable_states: ['ALL'], company_type: ['ALL'],
            min_employees: 0, max_employees: 999999, frequency_months: 12,
            document_required: false, penalty_amount: '', penalty_impact: 'Medium',
            scope: 'Company',
        });
    }, [isOpen, initialData, reset]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                    <h2 className="text-lg font-bold text-white">
                        {isEdit ? 'Edit Compliance Rule' : 'Add New Compliance Rule'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                    {/* Rule Name */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                            Rule Name *
                        </label>
                        <input
                            className={`w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
                ${errors.rule_name ? 'border-red-500' : 'border-slate-600'}`}
                            placeholder="e.g. GST Monthly Return"
                            {...register('rule_name', { required: 'Rule name is required' })}
                        />
                        {errors.rule_name && <p className="text-red-400 text-xs mt-1">{errors.rule_name.message}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                            Description
                        </label>
                        <textarea
                            rows={3}
                            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm
                placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                            placeholder="Brief description of this compliance requirement…"
                            {...register('description')}
                        />
                    </div>

                    {/* Multi-checkboxes */}
                    <Controller name="industry_type" control={control}
                        render={({ field }) => (
                            <CheckboxGroup label="Industry Type" options={INDUSTRIES} value={field.value} onChange={field.onChange} />
                        )}
                    />
                    <Controller name="applicable_states" control={control}
                        render={({ field }) => (
                            <CheckboxGroup label="Applicable States" options={STATES} value={field.value} onChange={field.onChange} />
                        )}
                    />
                    <Controller name="company_type" control={control}
                        render={({ field }) => (
                            <CheckboxGroup label="Company Type" options={COMP_TYPES} value={field.value} onChange={field.onChange} />
                        )}
                    />

                    {/* Employee range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                                Min Employees
                            </label>
                            <input type="number" min={0}
                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                {...register('min_employees', { valueAsNumber: true, min: 0 })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                                Max Employees
                            </label>
                            <input type="number" min={0}
                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                {...register('max_employees', { valueAsNumber: true, min: 0 })}
                            />
                        </div>
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                            Frequency
                        </label>
                        <Controller name="frequency_months" control={control}
                            render={({ field }) => (
                                <div className="flex flex-wrap gap-2">
                                    {FREQUENCIES.map(({ label, value }) => (
                                        <button key={value} type="button"
                                            onClick={() => field.onChange(value)}
                                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors
                        ${field.value === value
                                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        />
                    </div>

                    {/* Penalty amount + impact */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                                Penalty Amount
                            </label>
                            <input
                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                placeholder="e.g. Up to ₹10,000"
                                {...register('penalty_amount')}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                                Penalty Impact
                            </label>
                            <select
                                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                {...register('penalty_impact')}
                            >
                                {IMPACTS.map((i) => <option key={i} value={i}>{i}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Document required toggle */}
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
                        <span className="text-sm text-slate-300">Document upload required?</span>
                        <Controller name="document_required" control={control}
                            render={({ field }) => (
                                <button type="button"
                                    onClick={() => field.onChange(!field.value)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${field.value ? 'bg-indigo-600' : 'bg-slate-600'}`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all
                    ${field.value ? 'left-7' : 'left-1'}`} />
                                </button>
                            )}
                        />
                    </div>

                    {/* Scope toggle */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                            Document Scope
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Does each state/branch need a separate document, or is one upload valid for all locations?</p>
                        <Controller name="scope" control={control}
                            render={({ field }) => (
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'Company', label: '🏢 Company-wide', sub: 'One upload valid for all branches' },
                                        { value: 'Branch', label: '📍 Location-specific', sub: 'Separate upload per state/branch' },
                                    ].map(({ value, label, sub }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => field.onChange(value)}
                                            className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-colors
                                                ${field.value === value
                                                    ? 'bg-indigo-600/15 border-indigo-500/60 text-white'
                                                    : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            <span className={`text-sm font-semibold ${field.value === value ? 'text-indigo-300' : ''}`}>{label}</span>
                                            <span className="text-xs text-slate-500 mt-0.5">{sub}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        />
                    </div>

                    {/* Form actions */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                            {isSubmitting ? 'Saving…' : isEdit ? 'Update Rule' : 'Add Rule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
