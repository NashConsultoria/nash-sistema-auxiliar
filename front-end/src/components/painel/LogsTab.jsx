import { useState, useEffect } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import { API_BASE } from "../../context/AuthContext";

export default function LogsTab({ token }) {
    const [logs, setLogs] = useState([]);
    const [carregandoLogs, setCarregandoLogs] = useState(false);

    useEffect(() => {
        if (!token) return;
        setCarregandoLogs(true);
        fetch(`${API_BASE}/api/logs`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then((res) => {
                if (!res.ok) throw new Error("Erro ao carregar logs.");
                return res.json();
            })
            .then((data) => setLogs(data))
            .catch((err) => console.error("Erro ao buscar logs:", err))
            .finally(() => setCarregandoLogs(false));
    }, [token]);

    const colunasLogs = [
        {
            label: "Data/Hora",
            key: "criado_em",
            width: "18%",
            Cell: ({ row }) => row.criado_em ? new Date(row.criado_em).toLocaleString("pt-BR") : "-"
        },
        {
            label: "Usuário",
            key: "usuario_nome",
            width: "22%",
            Cell: ({ row }) => (
                <div>
                    <div style={{ fontWeight: "600" }}>{row.usuario_nome || "Sistema"}</div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>{row.usuario_email}</div>
                </div>
            )
        },
        {
            label: "Ação",
            key: "acao",
            width: "20%",
            Cell: ({ row }) => {
                const cores = {
                    "Login": { bg: "rgba(34, 197, 94, 0.12)", text: "#16a34a", border: "rgba(34, 197, 94, 0.3)" },
                    "Cadastro": { bg: "rgba(59, 130, 246, 0.12)", text: "#2563eb", border: "rgba(59, 130, 246, 0.3)" },
                    "Edição": { bg: "rgba(249, 115, 22, 0.12)", text: "#ea580c", border: "rgba(249, 115, 22, 0.3)" },
                    "Importacao": { bg: "rgba(234, 179, 8, 0.12)", text: "#d97706", border: "rgba(234, 179, 8, 0.3)" },
                    "IMPORTAR_PLANO_CONTAS": { bg: "rgba(234, 179, 8, 0.12)", text: "#d97706", border: "rgba(234, 179, 8, 0.3)" },
                    "EXPORTAR_EXCEL": { bg: "rgba(234, 179, 8, 0.12)", text: "#d97706", border: "rgba(234, 179, 8, 0.3)" },
                    "ExclusaoLote": { bg: "rgba(239, 68, 68, 0.12)", text: "#dc2626", border: "rgba(239, 68, 68, 0.3)" },
                    "Vincular Contratante": { bg: "rgba(14, 165, 233, 0.12)", text: "#0284c7", border: "rgba(14, 165, 233, 0.3)" },
                    "Remover Vínculo Contratante": { bg: "rgba(239, 68, 68, 0.12)", text: "#dc2626", border: "rgba(239, 68, 68, 0.3)" }
                };

                const estilo = cores[row.acao] || { bg: "rgba(148, 163, 184, 0.12)", text: "#64748b", border: "rgba(148, 163, 184, 0.3)" };

                return (
                    <span style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "600",
                        backgroundColor: estilo.bg,
                        color: estilo.text,
                        border: `1px solid ${estilo.border}`,
                        display: "inline-block",
                        whiteSpace: "nowrap"
                    }}>
                        {row.acao}
                    </span>
                );
            }
        },
        {
            label: "Tabela Afetada",
            key: "tabela",
            width: "15%",
            Cell: ({ row }) => row.tabela ? (
                <span style={{ fontFamily: "monospace" }}>{row.tabela}</span>
            ) : "-"
        },
        {
            label: "Detalhes da Operação",
            key: "detalhes",
            width: "25%",
            Cell: ({ row }) => row.detalhes ? (
                <div style={{ 
                    backgroundColor: "rgba(0, 0, 0, 0.04)", 
                    padding: "6px 10px", 
                    borderRadius: "6px", 
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                    maxHeight: "90px",
                    overflowY: "auto",
                    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                    whiteSpace: "pre-wrap",
                    fontSize: "11px",
                    lineHeight: "1.4",
                    textAlign: "left",
                    color: "inherit"
                }}>
                    {typeof row.detalhes === "string" ? row.detalhes : JSON.stringify(row.detalhes, null, 2)}
                </div>
            ) : (
                <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>-</span>
            )
        }
    ];

    return (
        <Card title="Log de Atividades dos Usuários">
            <p style={{ marginBottom: "16px" }}>
                Visualize o histórico detalhado das ações e acessos executados por cada usuário no sistema.
            </p>
            {carregandoLogs ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                    Carregando histórico de ações...
                </div>
            ) : (
                <Table columns={colunasLogs} data={logs} />
            )}
        </Card>
    );
}