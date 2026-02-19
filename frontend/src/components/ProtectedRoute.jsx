import { jwtDecode } from 'jwt-decode';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute
 * Wraps a protected page. Redirects to "/" if:
 *   - No token in localStorage
 *   - Token cannot be decoded
 *   - Token role does not match the required `role` prop
 *
 * Usage:
 *   <ProtectedRoute role="developer"><DeveloperDashboard /></ProtectedRoute>
 */
export default function ProtectedRoute({ children, role }) {
    const token = localStorage.getItem('token');

    if (!token) return <Navigate to="/" replace />;

    try {
        const decoded = jwtDecode(token);

        // Check expiry
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
            localStorage.removeItem('token');
            return <Navigate to="/" replace />;
        }

        // Check role
        if (role && decoded.role !== role) {
            return <Navigate to="/" replace />;
        }

        return children;
    } catch {
        localStorage.removeItem('token');
        return <Navigate to="/" replace />;
    }
}
