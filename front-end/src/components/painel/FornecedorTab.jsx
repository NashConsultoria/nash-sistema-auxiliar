import { useState, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";
import { ExportarExcel } from "../../utils/ExportarExcel";

export default function FornecedorTab({ token, fornecedores = [], carregarFornecedores }) {
    const [modoCadastroFornecedor, setModoCadastroFornecedor] = useState(false);
    const [editandoFornecedorId, setEditandoFornecedorId] = useState(null);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [formFornecedor, setFormFornecedor] = useState({ nome: "", cpfCnpj: "" });

    // --- ESTADOS DO FILTROBAR ---
    const [filtros, setFiltros] = useState({
        nome: "",
        cpfCnpj: ""
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: "",
            cpfCnpj: ""
        });
    };

    // --- LÓGICA DE FILTRAGEM DINÂMICA ---
    const filtrarFornecedorExcecao = (chaveIgnorada) => {
        return fornecedores.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || "").toLowerCase();
            const cpfCnpj = (item.cpfCnpj || item.cpf_cnpj || "").toLowerCase();

            return (
                passaStatus &&
                (chaveIgnorada === "nome" || nome.includes(filtros.nome.toLowerCase().trim())) &&
                (chaveIgnorada === "cpfCnpj" || cpfCnpj.includes(filtros.cpfCnpj.toLowerCase().trim()))
            );
        });
    };

    const opcoesNome = useMemo(() => {
        const dados = filtrarFornecedorExcecao("nome");
        return Array.from(new Set(dados.map((b) => b.nome).filter(Boolean)));
    }, [fornecedores, filtros, mostrarInativos]);

    const opcoesCpfCnpj = useMemo(() => {
        const dados = filtrarFornecedorExcecao("cpfCnpj");
        return Array.from(
            new Set(dados.map((b) => b.cpfCnpj || b.cpf_cnpj).filter(Boolean))
        );
    }, [fornecedores, filtros, mostrarInativos]);

    const schemaFiltroFornecedor = [
        {
            key: "nome",
            label: "Nome do Fornecedor",
            tipo: "inputlist",
            placeholder: "Buscar por Nome...",
            options: opcoesNome
        },
        {
            key: "cpfCnpj",
            label: "CPF/CNPJ",
            tipo: "inputlist",
            placeholder: "Buscar por CPF/CNPJ...",
            options: opcoesCpfCnpj
        }
    ];

    // 4. CORRIGIDO: Lista filtrada considerando o filtro de código
    const fornecedoresFiltrados = useMemo(() => {
        return fornecedores.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || "").toLowerCase();
            const cpfCnpj = (item.cpfCnpj || item.cpf_cnpj || "").toLowerCase();

            return (
                passaStatus &&
                nome.includes(filtros.nome.toLowerCase().trim()) &&
                cpfCnpj.includes(filtros.cpfCnpj.toLowerCase().trim())
            );
        });
    }, [fornecedores, filtros, mostrarInativos]);

    const handleSalvarFornecedor = async (e) => {
        e.preventDefault();

        if (!formFornecedor.nome.trim()) {
            alert("O Nome do Fornecedor é obrigatório.");
            return;
        }

        setCarregando(true);

        const url = editandoFornecedorId
            ? `${API_BASE}/api/fornecedor/${editandoFornecedorId}`
            : `${API_BASE}/api/fornecedor`;

        const metodo = editandoFornecedorId ? "PUT" : "POST";

        const payload = {
            nome: formFornecedor.nome.trim(),
            cpfCnpj: formFornecedor.cpfCnpj.trim()
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
            if (!res.ok) throw new Error(resposta.detail || resposta.mensagem || "Erro ao salvar Fornecedor.");

            alert("Fornecedor salvo com sucesso!");
            setModoCadastroFornecedor(false);
            if (carregarFornecedores) carregarFornecedores();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const handleIniciarEdicaoFornecedor = (f) => {
        setFormFornecedor({
            nome: f.nome || "",
            cpfCnpj: f.cpfCnpj || f.cpf_cnpj || ""
        });
        setEditandoFornecedorId(f.id);
        setModoCadastroFornecedor(true);
    };

    const handleAlternarStatusFornecedor = async (f) => {
        const isAtivo = Number(f.status) === 1;
        const confirmacao = window.confirm(
            `Deseja realmente ${isAtivo ? "desativar" : "reativar"} o fornecedor "${f.nome}"?`
        );
        if (!confirmacao) return;

        try {
            const res = await fetch(
                `${API_BASE}/api/fornecedor/${f.id}/status?ativo=${!isAtivo}`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || resposta.mensagem || "Erro ao alterar status.");

            alert(resposta.mensagem || "Status atualizado com sucesso!");
            if (carregarFornecedores) carregarFornecedores();
        } catch (err) {
            alert(err.message);
        }
    };

    // 5. ADICIONADA A COLUNA DE CÓDIGO NA TABELA
    const colunasFornecedor = [
        {
            label: "Nome do Fornecedor",
            key: "nome",
            width: "45%",
            Cell: ({ row }) => (
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontWeight: "500" }}>{row.nome}</span>
                    {Number(row.status) === 2 && (
                        <span
                            style={{
                                fontSize: "11px",
                                backgroundColor: "#ef4444",
                                color: "#fff",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                marginLeft: "8px",
                                fontWeight: "600"
                            }}
                        >
                            Inativo
                        </span>
                    )}
                </div>
            )
        },
        {
            label: "CPF/CNPJ",
            key: "cpfCnpj",
            width: "35%",
            Cell: ({ row }) => (
                <span style={{ fontWeight: "600" }}>
                    {row.cpfCnpj || row.cpf_cnpj || "-"}
                </span>
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
                        <Button onClick={() => handleIniciarEdicaoFornecedor(row)}>
                            Editar
                        </Button>
                        <Button
                            onClick={() => handleAlternarStatusFornecedor(row)}
                            style={{
                                backgroundColor: isAtivo ? "#ef444422" : "#22c55e22",
                                color: isAtivo ? "#f87171" : "#4ade80",
                                border: isAtivo ? "1px solid #ef444444" : "1px solid #22c55e44"
                            }}
                        >
                            {isAtivo ? "Inativar" : "Reativar"}
                        </Button>
                    </div>
                );
            }
        }
    ];

    const handleExportarFornecedor = () => {
        ExportarExcel({
            tabela: "fornecedor",
            colunas: ["FORNECEDOR", "CPF-CNPJ"],
            nomeArquivoCustomizado: "Mapa_Fornecedor.xlsx"
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastroFornecedor ? (
                <Card title="Gerenciamento de Fornecedores">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie os fornecedores cadastrados no sistema.</p>
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
                                setEditandoFornecedorId(null);
                                setFormFornecedor({ nome: "", cpfCnpj: "" });
                                setModoCadastroFornecedor(true);
                            }}
                        >
                            + Cadastrar Novo Fornecedor
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltroFornecedor}
                                filtros={filtros}
                                onChange={handleFilterChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", margin: "8px" }}>
                        <Button onClick={() => handleExportarFornecedor()}>Baixar Tudo</Button>
                    </div>

                    <Table
                        columns={colunasFornecedor}
                        data={fornecedoresFiltrados}
                        getRowClassName={(row) => (Number(row.status) === 2 ? "usuario-inativo" : "")}
                    />
                </Card>
            ) : (
                <Card title={editandoFornecedorId ? "Editar Fornecedor" : "Cadastrar Novo Fornecedor"}>
                    <form onSubmit={handleSalvarFornecedor} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        
                        {/* CAMPO DE INPUT PARA O NOME */}
                        <div className="form-group">
                            <label className="form-label">Nome do Fornecedor *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formFornecedor.nome}
                                onChange={(e) => setFormFornecedor({ ...formFornecedor, nome: e.target.value })}
                                placeholder="Ex:-"
                            />
                        </div>

                        {/* CAMPO DE INPUT PARA O CPF-CNPJ */}
                        <div className="form-group">
                            <label className="form-label">CPF/CNPJ do Fornecedor *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formFornecedor.cpfCnpj}
                                onChange={(e) => setFormFornecedor({ ...formFornecedor, cpfCnpj: e.target.value })}
                                placeholder="Ex: 001, 341, 104"
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastroFornecedor(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Fornecedor"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}