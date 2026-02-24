import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axiosInstance';

export default function LoginPage() {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const navigate = useNavigate();
    const [serverError, setServerError] = useState('');
    const [loading, setLoading] = useState(false);

    const onSubmit = async (data) => {
        setServerError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/login', {
                email: data.email,
                password: data.password,
            });

            const { access_token } = res.data;

            // Persist token
            localStorage.setItem('token', access_token);

            // Decode role and redirect
            const decoded = jwtDecode(access_token);
            if (decoded.role === 'developer') {
                navigate('/developer');
            } else if (decoded.role === 'company') {
                navigate('/company');
            } else if (decoded.role === 'auditor') {
                navigate('/auditor');
            } else {
                setServerError('Unrecognised role in token.');
            }
        } catch (err) {
            const detail = err.response?.data?.detail;
            setServerError(detail || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-md">

                {/* Logo / header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">EZ Compliance</h1>
                    <p className="text-slate-400 mt-1 text-sm">Sign in to your account</p>
                </div>

                {/* Card */}
                <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email address
                            </label>
                            <input
                                type="email"
                                autoComplete="username"
                                placeholder="you@company.com"
                                className={`w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
                  ${errors.email ? 'border-red-500' : 'border-slate-600'}`}
                                {...register('email', {
                                    required: 'Email is required',
                                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
                                })}
                            />
                            {errors.email && (
                                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className={`w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
                  ${errors.password ? 'border-red-500' : 'border-slate-600'}`}
                                {...register('password', { required: 'Password is required' })}
                            />
                            {errors.password && (
                                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Server error */}
                        {serverError && (
                            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <p className="text-red-400 text-sm">{serverError}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-semibold py-2.5 rounded-xl transition-colors duration-200 text-sm shadow-md"
                        >
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    {/* Signup link */}
                    <p className="text-center text-slate-400 text-sm mt-6">
                        New company?{' '}
                        <a href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            Create an account
                        </a>
                    </p>
                </div>

                <p className="text-center text-slate-600 text-xs mt-6">
                    © 2026 EZ Compliance Tracker
                </p>
            </div>
        </div>
    );
}
