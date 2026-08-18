import { useState, useEffect, useMemo } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

export default function LogsTab({ token }) {
    const [logs, setLogs] = useState([]);
    const [carregandoLogs, setCarregandoLogs] = useState(false);

    // Estados dos Filtros
    const [filtros, setFiltros] = useState({
        usuario: "",
        ip: "",
        acao: "",
        tabela: ""
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            usuario: "",
            ip: "",
            acao: "",
            tabela: ""
        });
    };

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

    // Função auxiliar estilo Excel (ignora a própria chave para calcular as opções disponíveis)
    const filtrarLogsExcecao = (chaveIgnorada) => {
        return logs.filter((item) => {
            const usuario = (item.usuario_nome || "").toLowerCase();
            const ip = (item.ip || "").toLowerCase();
            const acao = (item.acao || "").toLowerCase();
            const tabela = (item.tabela || "").toLowerCase();

            return (
                (chaveIgnorada === "usuario" || usuario.includes(filtros.usuario.toLowerCase().trim())) &&
                (chaveIgnorada === "ip" || ip.includes(filtros.ip.toLowerCase().trim())) &&
                (chaveIgnorada === "acao" || acao.includes(filtros.acao.toLowerCase().trim())) &&
                (chaveIgnorada === "tabela" || tabela.includes(filtros.tabela.toLowerCase().trim()))
            );
        });
    };

    // Opções dinâmicas das listas (estilo Excel)
    const opcoesUsuarios = useMemo(() => {
        const dados = filtrarLogsExcecao("usuario");
        return Array.from(new Set(dados.map((l) => l.usuario_nome).filter(Boolean)));
    }, [logs, filtros]);

    const opcoesIps = useMemo(() => {
        const dados = filtrarLogsExcecao("ip");
        return Array.from(new Set(dados.map((l) => l.ip).filter(Boolean)));
    }, [logs, filtros]);

    const opcoesAcoes = useMemo(() => {
        const dados = filtrarLogsExcecao("acao");
        return Array.from(new Set(dados.map((l) => l.acao).filter(Boolean)));
    }, [logs, filtros]);

    const opcoesTabelas = useMemo(() => {
        const dados = filtrarLogsExcecao("tabela");
        return Array.from(new Set(dados.map((l) => l.tabela).filter(Boolean)));
    }, [logs, filtros]);

    // Schema do Filtro
    const schemaFiltroLogs = [
        {
            key: "usuario",
            label: "Usuário",
            tipo: "inputlist",
            placeholder: "Buscar usuário...",
            options: opcoesUsuarios
        },
        {
            key: "ip",
            label: "IP",
            tipo: "inputlist",
            placeholder: "Buscar IP...",
            options: opcoesIps
        },
        {
            key: "acao",
            label: "Ação",
            tipo: "inputlist",
            placeholder: "Buscar ação...",
            options: opcoesAcoes
        },
        {
            key: "tabela",
            label: "Tabela Afetada",
            tipo: "inputlist",
            placeholder: "Buscar tabela...",
            options: opcoesTabelas
        }
    ];

    // Resultado final filtrado exibido na tabela
    const logsFiltrados = useMemo(() => {
        return logs.filter((item) => {
            const usuario = (item.usuario_nome || "").toLowerCase();
            const ip = (item.ip || "").toLowerCase();
            const acao = (item.acao || "").toLowerCase();
            const tabela = (item.tabela || "").toLowerCase();

            return (
                usuario.includes(filtros.usuario.toLowerCase().trim()) &&
                ip.includes(filtros.ip.toLowerCase().trim()) &&
                acao.includes(filtros.acao.toLowerCase().trim()) &&
                tabela.includes(filtros.tabela.toLowerCase().trim())
            );
        });
    }, [logs, filtros]);

    const colunasLogs = [
        {
            label: "Data/Hora",
            key: "criado_em",
            width: "15%",
            Cell: ({ row }) => (row.criado_em ? new Date(row.criado_em).toLocaleString("pt-BR") : "-")
        },
        {
            label: "Usuário",
            key: "usuario_nome",
            width: "20%",
            Cell: ({ row }) => (
                <div>
                    <div style={{ fontWeight: "600" }}>{row.usuario_nome || "Sistema"}</div>
                    <div style={{ fontSize: "12px", opacity: 0.8 }}>{row.usuario_email}</div>
                </div>
            )
        },
        {
            label: "IP",
            key: "ip",
            width: "12%",
            Cell: ({ row }) => (
                <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                    {row.ip || "-"}
                </span>
            )
        },
        {
            label: "Ação",
            key: "acao",
            width: "18%",
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
            width: "13%",
            Cell: ({ row }) => (row.tabela ? (
                <span style={{ fontFamily: "monospace" }}>{row.tabela}</span>
            ) : "-")
        },
        {
            label: "Detalhes da Operação",
            key: "detalhes",
            width: "22%",
            Cell: ({ row }) => (row.detalhes ? (
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
            ))
        }
    ];

    return (
        <Card title="Log de Atividades dos Usuários">
            <p style={{ marginBottom: "16px" }}>
                Visualize o histórico detalhado das ações e acessos executados por cada usuário no sistema.
            </p>

            <FiltroBar
                schema={schemaFiltroLogs}
                filtros={filtros}
                onChange={handleFilterChange}
                onLimpar={limparFiltros}
            />

            {carregandoLogs ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                    Carregando histórico de ações...
                </div>
            ) : (
                <Table columns={colunasLogs} data={logsFiltrados} />
            )}
        </Card>
    );
}