import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro("");
        setCarregando(true);
        try {
            await login(email, senha);
            navigate("/simulator"); // Rota inicial do Sistema
        } catch (err) {
            setErro(err.message);
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "70vh",
        }}>
            <div style={{
                width: "100%",
                maxWidth: "400px",
                padding: "40px 30px",
                backgroundColor: "#ffffff",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
            }}>
                <h2 style={{ textAlign: "center", marginBottom: "24px", color: "#1e293b" }}>Acessar o Sistema</h2>
                
                {erro && (
                    <div style={{
                        padding: "10px",
                        backgroundColor: "#fef2f2",
                        color: "#ef4444",
                        borderRadius: "6px",
                        fontSize: "14px",
                        marginBottom: "16px",
                        border: "1px solid #fee2e2"
                    }}>
                        {erro}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "6px", color: "#475569" }}>E-mail:</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "6px", color: "#475569" }}>Senha:</label>
                        <input 
                            type="password" 
                            required
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            placeholder="••••••••"
                            style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={carregando}
                        style={{
                            padding: "12px",
                            backgroundColor: "#1e293b",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            cursor: carregando ? "not-allowed" : "pointer",
                            marginTop: "10px"
                        }}
                    >
                        {carregando ? "Autenticando..." : "Entrar"}
                    </button>
                </form>
            </div>
        </div>
    );
}