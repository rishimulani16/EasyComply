import { useNavigate } from 'react-router-dom';

export default function CompanySignup() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-lg bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Register Your Company</h2>
                <p className="text-slate-400 text-sm mb-6">
                    Multi-step signup form — coming next sprint.
                </p>
                <button
                    onClick={() => navigate('/')}
                    className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
                >
                    ← Back to Login
                </button>
            </div>
        </div>
    );
}
