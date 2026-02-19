import { useNavigate } from 'react-router-dom';

export default function CompanyDashboard() {
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
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <span className="font-bold text-lg">EZ Compliance — Company Panel</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                    Logout
                </button>
            </nav>

            {/* Summary bar placeholder */}
            <main className="p-8 max-w-7xl mx-auto">
                <h2 className="text-2xl font-bold mb-2">Compliance Dashboard</h2>
                <p className="text-slate-400">Your compliance calendar — coming next sprint.</p>

                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Rules', color: 'text-white' },
                        { label: 'Completed', color: 'text-emerald-400' },
                        { label: 'Pending', color: 'text-yellow-400' },
                        { label: 'Overdue', color: 'text-red-400' },
                    ].map(({ label, color }) => (
                        <div key={label}
                            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-col gap-2">
                            <span className="text-slate-400 text-sm">{label}</span>
                            <span className={`text-3xl font-bold ${color}`}>—</span>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
