import { useState, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

export default function ContratantesTab({ token, contratantes = [], carregarContratantes }) {
    const [modoCadastroContratante, setModoCadastroContratante] = useState(false);
    const [editandoContratanteId, setEditandoContratanteId] = useState(null);
    const [mostrarContratantesInativos, setMostrarContratantesInativos] = useState(false);
    const [formContratante, setFormContratante] = useState({ nome: "", razaoSocial: "" });
    const [carregando, setCarregando] = useState(false);

    // --- ESTADOS DO FILTROBAR ---
    const [filtros, setFiltros] = useState({
        nome: '',
        razaoSocial: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: '',
            razaoSocial: ''
        });
    };

    // --- LÓGICA DE FILTRAGEM DINÂMICA (EXCEL STYLE) ---
    // Filtra aplicando apenas o controle de inativos e os outros filtros, exceto a chave atual
    const filtrarContratantesExcecao = (chaveIgnorada) => {
        return contratantes.filter((item) => {
            const passaStatus = mostrarContratantesInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const razaoSocial = (item.razaoSocial || item.razao_social || '').toLowerCase();

            return (
                passaStatus &&
                (chaveIgnorada === 'nome' || nome.includes(filtros.nome.toLowerCase().trim())) &&
                (chaveIgnorada === 'razaoSocial' || razaoSocial.includes(filtros.razaoSocial.toLowerCase().trim()))
            );
        });
    };

    const opcoesNome = useMemo(() => {
        const dados = filtrarContratantesExcecao('nome');
        return Array.from(new Set(dados.map(c => c.nome).filter(Boolean)));
    }, [contratantes, filtros, mostrarContratantesInativos]);

    const opcoesRazaoSocial = useMemo(() => {
        const dados = filtrarContratantesExcecao('razaoSocial');
        return Array.from(new Set(dados.map(c => c.razaoSocial || c.razao_social).filter(Boolean)));
    }, [contratantes, filtros, mostrarContratantesInativos]);

    // Schema de configuração para o FiltroBar
    const schemaFiltroContratante = [
        {
            key: "nome",
            label: "Nome do Contratante",
            tipo: "inputlist",
            placeholder: "Buscar por Nome...",
            options: opcoesNome
        },
        {
            key: "razaoSocial",
            label: "Razão Social",
            tipo: "inputlist",
            placeholder: "Buscar por Razão Social...",
            options: opcoesRazaoSocial
        }
    ];

    // Lista filtrada final que alimenta a Tabela
    const contratantesFiltrados = useMemo(() => {
        return contratantes.filter((item) => {
            const passaStatus = mostrarContratantesInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const razaoSocial = (item.razaoSocial || item.razao_social || '').toLowerCase();

            return (
                passaStatus &&
                nome.includes(filtros.nome.toLowerCase().trim()) &&
                razaoSocial.includes(filtros.razaoSocial.toLowerCase().trim())
            );
        });
    }, [contratantes, filtros, mostrarContratantesInativos]);

    // --- SALVAR CONTRATANTE ---
    const handleSalvarContratante = async (e) => {
        e.preventDefault();

        if (!formContratante.nome.trim()) {
            alert("O Nome do Contratante é obrigatório.");
            return;
        }

        setCarregando(true);

        const url = editandoContratanteId 
            ? `${API_BASE}/api/contratantes/${editandoContratanteId}` 
            : `${API_BASE}/api/contratantes`;
            
        const metodo = editandoContratanteId ? "PUT" : "POST";

        const statusAtual = editandoContratanteId
            ? Number(contratantes.find(c => c.id === editandoContratanteId)?.status || 1)
            : 1;

        const payload = {
            nome: formContratante.nome.trim(),
            razaoSocial: formContratante.razaoSocial?.trim() ? formContratante.razaoSocial.trim() : null,
            status: statusAtual
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
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar contratante.");

            alert("Contratante salvo com sucesso!");
            setModoCadastroContratante(false);
            if (carregarContratantes) carregarContratantes();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const handleIniciarEdicaoContratante = (contratante) => {
        setFormContratante({
            nome: contratante.nome || "",
            razaoSocial: contratante.razaoSocial || contratante.razao_social || ""
        });
        setEditandoContratanteId(contratante.id);
        setModoCadastroContratante(true);
    };

    const handleAlternarStatusContratante = async (contratante) => {
        const isAtivo = Number(contratante.status) === 1;
        const confirmacao = window.confirm(`Deseja realmente ${isAtivo ? "desativar" : "reativar"} o contratante "${contratante.nome}"?`);
        if (!confirmacao) return;

        try {
            const res = await fetch(`${API_BASE}/api/contratantes/${contratante.id}`, {
                method: isAtivo ? "DELETE" : "PUT",
                headers: {
                    ...(!isAtivo && { "Content-Type": "application/json" }),
                    Authorization: `Bearer ${token}`
                },
                ...(!isAtivo && { body: JSON.stringify({ ...contratante, status: 1 }) })
            });
            if (!res.ok) throw new Error("Erro ao alterar status do contratante.");

            alert("Status atualizado!");
            if (carregarContratantes) carregarContratantes();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasContratantes = [
        {
            label: "Nome do Contratante",
            key: "nome",
            width: "50%",
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
            label: "Razão Social",
            key: "razaoSocial",
            width: "30%",
            Cell: ({ row }) => row.razaoSocial || row.razao_social || "-"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button onClick={() => handleIniciarEdicaoContratante(row)}>
                        Editar
                    </Button>
                    <Button
                        onClick={() => handleAlternarStatusContratante(row)}
                        style={{
                            backgroundColor: Number(row.status) === 1 ? "#ef444422" : "#22c55e22",
                            color: Number(row.status) === 1 ? "#f87171" : "#4ade80",
                        }}
                    >
                        {Number(row.status) === 1 ? "Inativar" : "Reativar"}
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastroContratante ? (
                /* TELA 1: LISTAGEM DE CONTRATANTES */
                <Card title="Gerenciamento de Contratantes">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie as empresas contratantes cadastradas no sistema.</p>
                            <Button
                                onClick={() => setMostrarContratantesInativos(!mostrarContratantesInativos)}
                                style={{
                                    backgroundColor: mostrarContratantesInativos ? "#ef4444" : "#35448a",
                                }}
                            >
                                {mostrarContratantesInativos ? "Ver Apenas Ativos" : "Mostrar Inativos"}
                            </Button>
                        </div>
                        <Button
                            onClick={() => {
                                setEditandoContratanteId(null);
                                setFormContratante({ nome: "", razaoSocial: "" });
                                setModoCadastroContratante(true);
                            }}
                        >
                            + Cadastrar Novo Contratante
                        </Button>
                    </div>

                    {/* BARRA DE FILTROS */}
                    <div className="card-filtros mb-4">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltroContratante}
                                filtros={filtros}
                                onChange={handleFilterChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>

                    <Table
                        columns={colunasContratantes}
                        data={contratantesFiltrados}
                        getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                    />
                </Card>
            ) : (
                /* TELA 2: FORMULÁRIO DE CADASTRO/EDIÇÃO DE CONTRATANTE */
                <Card title={editandoContratanteId ? "Editar Contratante" : "Cadastrar Novo Contratante"}>
                    <form onSubmit={handleSalvarContratante} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>

                        {/* Campo 1: Nome do Contratante */}
                        <div className="form-group">
                            <label className="form-label">Nome do Contratante *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formContratante.nome}
                                onChange={(e) => setFormContratante({ ...formContratante, nome: e.target.value })}
                                placeholder="Ex: NE"
                            />
                        </div>

                        {/* Campo 2: Razão Social */}
                        <div className="form-group">
                            <label className="form-label">Razão Social:</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formContratante.razaoSocial}
                                onChange={(e) => setFormContratante({ ...formContratante, razaoSocial: e.target.value })}
                                placeholder="Ex: NomeEmpresa LTDA"
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastroContratante(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Contratante"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}