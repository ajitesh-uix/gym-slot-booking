import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../authContext';

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/sessions" replace />;
  }
  return children;
}
