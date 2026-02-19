/**
 * CompanySignup.jsx
 * Multi-step company onboarding form — 4 steps.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axiosInstance';

const INDUSTRIES = ['AI', 'IT', 'Transport'];
const STATES = ['Gujarat', 'Maharashtra', 'Rajasthan', 'Goa'];
const MAX_BRANCHES = 5;

function StepIndicator({ current, total }) {
    return (
        <div className="flex items-center gap-1 justify-center mb-8">
            {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
            ${i + 1 < current ? 'bg-indigo-600 border-indigo-600 text-white'
                            : i + 1 === current ? 'bg-transparent border-indigo-400 text-indigo-400'
                                : 'bg-transparent border-slate-600 text-slate-600'}`}
                    >
                        {i + 1 < current
                            ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            : i + 1
                        }
                    </div>
                    {i < total - 1 && (
                        <div className={`w-10 h-0.5 ${i + 1 < current ? 'bg-indigo-600' : 'bg-slate-700'} transition-all`} />
                    )}
                </div>
            ))}
        </div>
    );
}

function CheckBtn({ checked, onClick, children }) {
    return (
        <button type="button" onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors
        ${checked ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'}`}
        >
            {children}
        </button>
    );
}

export default function CompanySignup() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [industries, setIndustries] = useState([]);
    const [branches, setBranches] = useState(['']);
    const [toast, setToast] = useState('');
    const [serverError, setServerError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { register, getValues, trigger, formState: { errors } } = useForm({
        defaultValues: {
            company_name: '',
            email: '',
            password: '',
            company_type: 'Pvt Ltd',
            employee_count: '',
            hq_state: 'Gujarat',
            subscription: 'Basic',
        },
    });

    const totalSteps = getValues('subscription') === 'Enterprise' ? 4 : 3;

    // ── Step navigation ──────────────────────────────────────────────
    const next = async () => {
        let fields = [];
        if (step === 1) fields = ['company_name', 'email', 'password'];
        if (step === 2) fields = ['company_type', 'employee_count', 'hq_state', 'subscription'];
        const ok = await trigger(fields);
        if (ok) setStep((s) => s + 1);
    };
    const back = () => setStep((s) => s - 1);

    const toggleIndustry = (ind) =>
        setIndustries((prev) => prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]);

    // ── Submit ───────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setServerError('');
        if (industries.length === 0) { setServerError('Please select at least one industry.'); return; }
        setSubmitting(true);
        const vals = getValues();
        const payload = {
            company_name: vals.company_name,
            email: vals.email,
            password: vals.password,
            industry_type: industries,
            company_type: [vals.company_type],
            hq_state: vals.hq_state,
            branch_states: vals.subscription === 'Enterprise' ? branches.filter(Boolean) : [],
            employee_count: parseInt(vals.employee_count, 10),
            subscription: vals.subscription,
        };
        try {
            const res = await api.post('/company/signup', payload);
            localStorage.setItem('token', res.data.access_token);
            setToast(`✅ ${res.data.total_rules_matched} compliance rules loaded for your company!`);
            setTimeout(() => navigate('/company'), 2000);
        } catch (err) {
            setServerError(err.response?.data?.detail ?? 'Signup failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const inputCls = (err) => `w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-white text-sm
    placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
    ${err ? 'border-red-500' : 'border-slate-600'}`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10">

            {/* Toast */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-semibold animate-bounce">
                    {toast}
                </div>
            )}

            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 mb-3 shadow-lg">
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Register Your Company</h1>
                    <p className="text-slate-400 text-sm mt-1">Get your compliance calendar in minutes</p>
                </div>

                <StepIndicator current={step} total={totalSteps} />

                <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">

                    {/* ── Step 1: Account Setup ── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-white mb-4">Account Setup</h2>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide font-medium">Company Name *</label>
                                <input className={inputCls(errors.company_name)} placeholder="Acme Pvt Ltd"
                                    {...register('company_name', { required: 'Company name is required' })} />
                                {errors.company_name && <p className="text-red-400 text-xs mt-1">{errors.company_name.message}</p>}
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide font-medium">Admin Email *</label>
                                <input type="email" className={inputCls(errors.email)} placeholder="admin@company.com"
                                    {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })} />
                                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide font-medium">Password *</label>
                                <input type="password" className={inputCls(errors.password)} placeholder="Min. 8 characters"
                                    {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })} />
                                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Company Profile ── */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold text-white mb-4">Company Profile</h2>

                            {/* Industry */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Industry Type *</label>
                                <div className="flex gap-2 flex-wrap">
                                    {INDUSTRIES.map((ind) => (
                                        <CheckBtn key={ind} checked={industries.includes(ind)} onClick={() => toggleIndustry(ind)}>{ind}</CheckBtn>
                                    ))}
                                </div>
                                {industries.length === 0 && <p className="text-slate-500 text-xs mt-1">Select at least one</p>}
                            </div>

                            {/* Company type */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Company Type</label>
                                <div className="flex gap-3">
                                    {['Pvt Ltd', 'Public Ltd'].map((t) => (
                                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" value={t} {...register('company_type')}
                                                className="accent-indigo-500 w-4 h-4" />
                                            <span className="text-slate-300 text-sm">{t}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Employees */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide font-medium">No. of Employees *</label>
                                <input type="number" min={1} className={inputCls(errors.employee_count)} placeholder="e.g. 50"
                                    {...register('employee_count', { required: 'Required', min: { value: 1, message: 'Min 1' } })} />
                                {errors.employee_count && <p className="text-red-400 text-xs mt-1">{errors.employee_count.message}</p>}
                            </div>

                            {/* HQ State */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wide font-medium">HQ State</label>
                                <select className={inputCls(false)} {...register('hq_state')}>
                                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Plan */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Subscription Plan</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['Basic', 'Enterprise'].map((plan) => (
                                        <label key={plan} className="cursor-pointer">
                                            <input type="radio" value={plan} {...register('subscription')} className="peer sr-only" />
                                            <div className={`border rounded-xl p-3 text-center transition-all
                        peer-checked:border-indigo-500 peer-checked:bg-indigo-600/20 border-slate-600 hover:border-slate-500`}>
                                                <p className="font-semibold text-white text-sm">{plan}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {plan === 'Basic' ? '₹2,999/mo · 1 location' : '₹9,999/mo · Multi-branch'}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Branch Locations (Enterprise only) ── */}
                    {step === 3 && getValues('subscription') === 'Enterprise' && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-white mb-4">Branch Locations</h2>
                            {branches.map((b, i) => (
                                <div key={i} className="flex gap-2">
                                    <select
                                        value={b}
                                        onChange={(e) => {
                                            const updated = [...branches];
                                            updated[i] = e.target.value;
                                            setBranches(updated);
                                        }}
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select state…</option>
                                        {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {branches.length > 1 && (
                                        <button type="button" onClick={() => setBranches(branches.filter((_, j) => j !== i))}
                                            className="px-3 py-2 rounded-xl bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors text-sm">✕</button>
                                    )}
                                </div>
                            ))}
                            {branches.length < MAX_BRANCHES && (
                                <button type="button" onClick={() => setBranches([...branches, ''])}
                                    className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add More Branch
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Final step: Review & Submit ── */}
                    {step === totalSteps && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-white mb-4">Ready to Submit</h2>
                            <div className="bg-slate-900 rounded-xl px-4 py-4 space-y-2 text-sm">
                                <Row label="Company" value={getValues('company_name')} />
                                <Row label="Email" value={getValues('email')} />
                                <Row label="Industries" value={industries.join(', ') || '—'} />
                                <Row label="Type" value={getValues('company_type')} />
                                <Row label="Employees" value={getValues('employee_count')} />
                                <Row label="HQ State" value={getValues('hq_state')} />
                                <Row label="Plan" value={getValues('subscription')} />
                            </div>
                            {serverError && (
                                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">{serverError}</p>
                            )}
                        </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex gap-3 mt-6">
                        {step > 1 && (
                            <button type="button" onClick={back}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                                ← Back
                            </button>
                        )}
                        {step < totalSteps ? (
                            <button type="button" onClick={next}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                                Next →
                            </button>
                        ) : (
                            <button type="button" onClick={handleSubmit} disabled={submitting}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                                {submitting && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>}
                                {submitting ? 'Submitting…' : '🚀 Create Company'}
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-4">
                    Already registered?{' '}
                    <Link to="/" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</Link>
                </p>
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex justify-between">
            <span className="text-slate-400">{label}</span>
            <span className="text-white font-medium">{value || '—'}</span>
        </div>
    );
}
