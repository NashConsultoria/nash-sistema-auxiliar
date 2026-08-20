import { useState, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

export default function BancosTab({ token, bancos = [], carregarBancos }) {
    const [modoCadastroBanco, setModoCadastroBanco] = useState(false);
    const [editandoBancoId, setEditandoBancoId] = useState(null);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [formBanco, setFormBanco] = useState({ nome: "" });
    const [carregando, setCarregando] = useState(false);

    // --- ESTADOS DO FILTROBAR ---
    const [filtros, setFiltros] = useState({
        nome: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: ''
        });
    };

    // --- LÓGICA DE FILTRAGEM DINÂMICA ---
    const filtrarBancosExcecao = (chaveIgnorada) => {
        return bancos.filter((item) => {
            // Status 1 = Ativo, Status 2 = Inativo
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();

            return (
                passaStatus &&
                (chaveIgnorada === 'nome' || nome.includes(filtros.nome.toLowerCase().trim()))
            );
        });
    };

    const opcoesNome = useMemo(() => {
        const dados = filtrarBancosExcecao('nome');
        return Array.from(new Set(dados.map(b => b.nome).filter(Boolean)));
    }, [bancos, filtros, mostrarInativos]);

    const schemaFiltroBanco = [
        {
            key: "nome",
            label: "Nome do Banco",
            tipo: "inputlist",
            placeholder: "Buscar por Nome...",
            options: opcoesNome
        }
    ];

    // Lista filtrada final que alimenta a Tabela
    const bancosFiltrados = useMemo(() => {
        return bancos.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();

            return (
                passaStatus &&
                nome.includes(filtros.nome.toLowerCase().trim())
            );
        });
    }, [bancos, filtros, mostrarInativos]);

    // --- SALVAR BANCO (CRIAR / ATUALIZAR) ---
    const handleSalvarBanco = async (e) => {
        e.preventDefault();

        if (!formBanco.nome.trim()) {
            alert("O Nome do Banco é obrigatório.");
            return;
        }

        setCarregando(true);

        const url = editandoBancoId 
            ? `${API_BASE}/api/bancos/${editandoBancoId}` 
            : `${API_BASE}/api/bancos`;
            
        const metodo = editandoBancoId ? "PUT" : "POST";

        const payload = {
            nome: formBanco.nome.trim()
        };

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: { 
                    "Content-Type": "application/json", 
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });
            
            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar banco.");

            alert("Banco salvo com sucesso!");
            setModoCadastroBanco(false);
            if (carregarBancos) carregarBancos();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const handleIniciarEdicaoBanco = (banco) => {
        setFormBanco({
            nome: banco.nome || ""
        });
        setEditandoBancoId(banco.id);
        setModoCadastroBanco(true);
    };

    // --- ALTERAR STATUS (CORRIGIDO PARA UTILIZAR O STATUS === 1) ---
    const handleAlternarStatusBanco = async (banco) => {
        const isAtivo = Number(banco.status) === 1;
        const confirmacao = window.confirm(`Deseja realmente ${isAtivo ? "desativar" : "reativar"} o banco "${banco.nome}"?`);
        if (!confirmacao) return;

        try {
            // Passa o booleano invertido na URL conforme esperado pelo backend FastAPI
            const res = await fetch(`${API_BASE}/api/bancos/${banco.id}/status?ativo=${!isAtivo}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao alterar status do banco.");

            alert(resposta.mensagem || "Status atualizado com sucesso!");
            if (carregarBancos) carregarBancos();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasBancos = [
        {
            label: "Nome do Banco",
            key: "nome",
            width: "80%",
            Cell: ({ row }) => (
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontWeight: "500" }}>{row.nome}</span>
                    {Number(row.status) === 2 && (
                        <span style={{
                            fontSize: "11px", 
                            backgroundColor: "#ef4444", 
                            color: "#fff",
                            padding: "2px 6px", 
                            borderRadius: "4px", 
                            marginLeft: "8px", 
                            fontWeight: "600"
                        }}>
                            Inativo
                        </span>
                    )}
                </div>
            )
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "center" },
            Cell: ({ row }) => {
                const isAtivo = Number(row.status) === 1;
                return (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Button onClick={() => handleIniciarEdicaoBanco(row)}>
                            Editar
                        </Button>
                        <Button
                            onClick={() => handleAlternarStatusBanco(row)}
                            style={{
                                backgroundColor: isAtivo ? "#ef444422" : "#22c55e22",
                                color: isAtivo ? "#f87171" : "#4ade80",
                            }}
                        >
                            {isAtivo ? "Inativar" : "Reativar"}
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastroBanco ? (
                <Card title="Gerenciamento de Bancos">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie os bancos (instituições financeiras) cadastrados no sistema.</p>
                            <Button
                                onClick={() => setMostrarInativos(!mostrarInativos)}
                                style={{
                                    backgroundColor: mostrarInativos ? "#ef4444" : "#35448a",
                                }}
                            >
                                {mostrarInativos ? "Ver Apenas Ativos" : "Mostrar Inativos"}
                            </Button>
                        </div>
                        <Button
                            onClick={() => {
                                setEditandoBancoId(null);
                                setFormBanco({ nome: "" });
                                setModoCadastroBanco(true);
                            }}
                        >
                            + Cadastrar Novo Banco
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltroBanco}
                                filtros={filtros}
                                onChange={handleFilterChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>

                    <Table
                        columns={colunasBancos}
                        data={bancosFiltrados}
                        getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                    />
                </Card>
            ) : (
                <Card title={editandoBancoId ? "Editar Banco" : "Cadastrar Novo Banco"}>
                    <form onSubmit={handleSalvarBanco} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        <div className="form-group">
                            <label className="form-label">Nome do Banco *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formBanco.nome}
                                onChange={(e) => setFormBanco({ ...formBanco, nome: e.target.value })}
                                placeholder="Ex: Itaú, Banco do Brasil, Bradesco"
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastroBanco(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Banco"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}