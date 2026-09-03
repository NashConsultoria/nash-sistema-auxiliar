import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import FiltroBar from "../components/filtro/FiltroBar";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../context/AuthContext";

export default function ChangeLog() {
    const { usuario, token } = useAuth();
    const [logs, setLogs] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(null);
    const [modoNovo, setModoNovo] = useState(false);
    const [form, setForm] = useState({ versao: "", titulo: "", descricao: "" });

    const isAdmin = usuario?.perfil === 1

    const [filtros, setFiltros] = useState({
        versao: '',
        titulo: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            versao: '',
            titulo: ''
        });
    };

    const carregarChangelog = async () => {
        setCarregando(true);
        setErro(null);
        try {
            const res = await fetch(`${API_BASE}/api/changelog`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const detalhe = data?.detail || `HTTP ${res.status}`;
                console.error("Erro ao buscar changelog:", res.status, data);
                setErro(`Não foi possível carregar o changelog (${detalhe}).`);
                setLogs([]);
                return;
            }

            setLogs(data);
        } catch (err) {
            console.error("Falha de rede ao buscar changelog:", err);
            setErro("Não foi possível conectar ao servidor.");
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        if (token) carregarChangelog();
    }, [token]);

    const handleSalvar = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/api/changelog`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(form)
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const detalhe = data?.detail || `HTTP ${res.status}`;
                throw new Error(`Erro ao salvar versão: ${detalhe}`);
            }

            setModoNovo(false);
            setForm({ versao: "", titulo: "", descricao: "" });
            carregarChangelog();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };

    const filtrarChangelogExcecao = (chaveIgnorada) => {
        return logs.filter((item) => {
            const versao = (item.versao || '').toLowerCase();
            const titulo = (item.titulo || '').toLowerCase();

            return (
                (chaveIgnorada === 'versao' || versao.includes(filtros.versao.toLowerCase().trim())) &&
                (chaveIgnorada === 'titulo' || titulo.includes(filtros.titulo.toLowerCase().trim()))
            );
        });
    };

    const logsFiltrados = useMemo(() => {
        return filtrarChangelogExcecao('');
    }, [logs, filtros]);

    const opcoesVersao = useMemo(() => {
        const dados = filtrarChangelogExcecao('versao');
        return Array.from(new Set(dados.map(b => b.versao).filter(Boolean)));
    }, [logs, filtros]);

    const opcoesTitulo = useMemo(() => {
        const dados = filtrarChangelogExcecao('titulo');
        return Array.from(new Set(dados.map(b => b.titulo).filter(Boolean)));
    }, [logs, filtros]);

    const schemaFiltroChangelog = [
        {
            key: "versao",
            label: "Versões",
            tipo: "inputlist",
            placeholder: "Buscar por Versões...",
            options: opcoesVersao
        },
        {
            key: "titulo",
            label: "Título",
            tipo: "inputlist",
            placeholder: "Buscar por Título...",
            options: opcoesTitulo
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Card Principal: Filtros e Botão de Ação */}
            <Card title="Notas da Versão (Evoluções)">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <p>Visualize as atualizações do sistema.</p>
                    {isAdmin && !modoNovo && (
                        <Button onClick={() => setModoNovo(true)}> + Inserir Changelog </Button>
                    )}
                </div>

                <div className="card-filtros mb-4">
                    <div className="form-row">
                        <FiltroBar
                            schema={schemaFiltroChangelog}
                            filtros={filtros}
                            onChange={handleFilterChange}
                            onLimpar={limparFiltros}
                        />
                    </div>
                </div>

                {/* Card para Cadastro  */}
                <div style={{ marginTop: "12px"}}>
                    {isAdmin && modoNovo && (
                        <Card title="Cadastrar Nova Atualização">
                            <form onSubmit={handleSalvar} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Versão (Ex: v1.0.0)"
                                    value={form.versao}
                                    onChange={(e) => setForm({ ...form, versao: e.target.value })}
                                    required
                                />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Título da Atualização"
                                    value={form.titulo}
                                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                                    required
                                />
                                <textarea
                                    className="form-input"
                                    rows={6}
                                    placeholder="Descrição em Markdown (Ex: ### Novidades&#10;* Item 1)"
                                    value={form.descricao}
                                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                                    required
                                />
                                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                    <Button type="button" onClick={() => setModoNovo(false)}>Cancelar</Button>
                                    <Button type="submit">Publicar</Button>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>

                <div style={{ marginTop: "24px" }}>
                    {carregando ? (
                        <p>Carregando atualizações...</p>
                    ) : erro ? (
                        <p style={{ color: "#dc2626" }}>{erro}</p>
                    ) : logsFiltrados.length === 0 ? (
                        <p style={{ color: "#6b7280" }}>Nenhuma atualização encontrada.</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {logsFiltrados.map((item) => (
                                <div 
                                    key={item.id} 
                                    style={{ 
                                        borderTop: "1px solid #acadad", 
                                        paddingTop: "16px" 
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                                        <h2>{item.versao}</h2>
                                        <span>({new Date(item.criadoEm).toLocaleDateString("pt-BR")})</span>
                                    </div>

                                    <h3>{item.titulo}</h3>

                                    <div style={{ paddingLeft: "16px", marginTop: "12px" }}>
                                        <ReactMarkdown components={{hr: () => (<hr 
                                                style={{ 
                                                    border: "none", 
                                                    borderTop: "1px solid #acadad",
                                                    margin: "20px 0"
                                                }}/>)
                                            }}>{item.descricao}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

        </div>
    );
}