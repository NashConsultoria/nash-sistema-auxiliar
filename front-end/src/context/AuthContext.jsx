import { createContext, useContext, useState, useEffect } from "react";

export const API_BASE = "http://127.0.0.1:8000";
export const API_URL = "http://127.0.0.1:8000/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null); // {nome, perfil, contratanteId}
    const [carregando, setCarregando] = useState(true);
    const [token, setToken] = useState(() => localStorage.getItem("token"));

    // Ao carregar a aplicação, verifica se já existe um token salvo e se ele ainda é válido
    useEffect(() => {
        const tokenSalvo = localStorage.getItem("token");
        if (!tokenSalvo) {
            setCarregando(false);
            return;
        }

        fetch(`${API_BASE}/api/me`, {
            headers: { Authorization: `Bearer ${tokenSalvo}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error("Token inválido");
                return res.json();
            })
            .then((dados) => {
                setUsuario(dados);
                setToken(tokenSalvo); 
            })
            .catch(() => {
                localStorage.removeItem("token");
                setToken(null);
                setUsuario(null);
            })
            .finally(() => setCarregando(false));
    }, []);

    const login = async (email, senha) => {
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", senha);

        const res = await fetch(`${API_BASE}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });

        if (!res.ok) {
            const erro = await res.json().catch(() => ({}));
            throw new Error(erro.detail || "Email ou senha inválidos.");
        }

        const dados = await res.json();
        
        // 1. Salva no localStorage primeiro
        localStorage.setItem("token", dados.access_token);
        
        // 2. Atualiza os estados em lote (batching) de forma limpa
        setUsuario({
            id: dados.id,
            nome: dados.nome,
            email: dados.email,
            perfil: dados.perfil,
            contratanteId: dados.contratanteId,
            protegido: dados.protegido,
        });
        setToken(dados.access_token);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUsuario(null);
    };

    return (
        <AuthContext.Provider value={{ usuario, setUsuario, token, carregando, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}