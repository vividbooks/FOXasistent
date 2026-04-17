import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth, type AppRole } from "./auth/AuthContext";
import AdminPage from "./pages/AdminPage";
import CredentialsPage from "./pages/CredentialsPage";
import EmployeePage from "./pages/EmployeePage";
import LoginPage from "./pages/LoginPage";

function Guard({
  role,
  children,
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const { role: r, loading, session } = useAuth();
  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Načítám…</div>;
  }
  if (!session || !r) return <Navigate to="/login" replace />;
  if (r !== role) {
    return <Navigate to={r === "ADMIN" ? "/admin" : "/employee"} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { role, loading, session } = useAuth();
  if (loading) return <div className="p-8 text-center text-zinc-500">Načítám…</div>;
  if (!session || !role) return <Navigate to="/login" replace />;
  return <Navigate to={role === "ADMIN" ? "/admin" : "/employee"} replace />;
}

function CredentialsGate() {
  const { loading, session } = useAuth();
  if (loading) return <div className="p-8 text-center text-zinc-500">Načítám…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <CredentialsPage />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/employee"
            element={
              <Guard role="EMPLOYEE">
                <EmployeePage />
              </Guard>
            }
          />
          <Route
            path="/admin"
            element={
              <Guard role="ADMIN">
                <AdminPage />
              </Guard>
            }
          />
          <Route path="/credentials" element={<CredentialsGate />} />
          <Route path="/" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
