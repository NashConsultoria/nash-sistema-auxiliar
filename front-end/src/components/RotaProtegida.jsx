import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RotaProtegida({ children, perfisPermitidos }) {
    const { usuario, carregando } = useAuth();

    if (carregando) {
        return <div style={{ padding: "40px", textAlign: "center" }}>Carregando...</div>;
    }

    if (!usuario) {
        return <Navigate to="/login" replace />;
    }

    if (perfisPermitidos && !perfisPermitidos.includes(usuario.perfil)) {
        return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-color3)" }}>
            Você não tem permissão para acessar esta página.
        </div>;
    }

    return children;
}
