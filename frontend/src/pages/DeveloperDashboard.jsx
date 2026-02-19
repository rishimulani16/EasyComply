import { useNavigate } from 'react-router-dom';

export default function DeveloperDashboard() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Top nav */}
            <nav className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944..." />
                        </svg>
                    </div>
                    <span className="font-bold text-lg">EZ Compliance — Developer Panel</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                    Logout
                </button>
            </nav>

            {/* Content placeholder */}
            <main className="p-8 max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold mb-2">Developer Dashboard</h2>
                <p className="text-slate-400">
                    Company list and compliance rule CRUD — coming next sprint.
                </p>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Companies', 'Active Rules', 'Audit Logs'].map((label) => (
                        <div key={label}
                            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-2">
                            <span className="text-slate-400 text-sm">{label}</span>
                            <span className="text-3xl font-bold text-indigo-400">—</span>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
