import { useState, useMemo, useEffect, useCallback } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import Inputlist from "../Inputlist/Inputlist";
import { API_BASE } from "../../context/AuthContext";
import { ExportarExcel } from "../../utils/ExportarExcel";

export default function FornecedorTab({ token, fornecedores = [], carregarFornecedores }) {
    const [modoCadastroFornecedor, setModoCadastroFornecedor] = useState(false);
    const [editandoFornecedorId, setEditandoFornecedorId] = useState(null);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [formFornecedor, setFormFornecedor] = useState({ nome: "", cpfCnpj: "" });

    // --- ESTADOS DE REGRAS DE FORNECEDOR ---
    const [regras, setRegras] = useState([]);
    const [carregandoRegras, setCarregandoRegras] = useState(false);
    const [modoCadastroRegra, setModoCadastroRegra] = useState(false);
    const [regraEmEdicaoId, setRegraEmEdicaoId] = useState(null);
    const [salvandoRegra, setSalvandoRegra] = useState(false);
    const [formRegra, setFormRegra] = useState({
        termoDescricao: "",
        termoTipo: "",
        fornecedorTexto: ""
    });

    const [filtrosRegra, setFiltrosRegra] = useState({
        descricao: "",
        tipo: "",
        fornecedor: ""
    });

    // --- ESTADOS DO FILTROBAR (FORNECEDORES) ---
    const [filtros, setFiltros] = useState({
        nome: "",
        cpfCnpj: ""
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({ nome: "", cpfCnpj: "" });
    };

    // --- CARREGAR REGRAS DA API ---
    const carregarRegras = useCallback(async () => {
        setCarregandoRegras(true);
        try {
            const res = await fetch(`${API_BASE}/api/fornecedor/regras`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Erro ao carregar regras de fornecedor.");
            setRegras(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err.message);
        } finally {
            setCarregandoRegras(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            carregarRegras();
        }
    }, [token, carregarRegras]);

    // --- MANIPULAÇÃO DE REGRAS (CRUD) ---
    const handleSalvarRegra = async (e) => {
        e.preventDefault();

        if (!formRegra.termoDescricao.trim() && !formRegra.termoTipo.trim()) {
            alert("Preencha ao menos a Descrição ou o Tipo.");
            return;
        }

        const fornecedorEncontrado = fornecedores.find(
            (f) => (f.nome || "").toLowerCase().trim() === formRegra.fornecedorTexto.toLowerCase().trim()
        );

        if (!fornecedorEncontrado) {
            alert("Selecione um Fornecedor válido cadastrado no sistema.");
            return;
        }

        setSalvandoRegra(true);

        const url = regraEmEdicaoId
            ? `${API_BASE}/api/fornecedor/regras/${regraEmEdicaoId}`
            : `${API_BASE}/api/fornecedor/regras`;

        const metodo = regraEmEdicaoId ? "PUT" : "POST";

        const payload = {
            termoDescricao: formRegra.termoDescricao.trim() || null,
            termoTipo: formRegra.termoTipo.trim() || null,
            fornecedorId: fornecedorEncontrado.id
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
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar regra.");

            alert("Regra de fornecedor salva com sucesso!");
            setModoCadastroRegra(false);
            carregarRegras();
        } catch (err) {
            alert(err.message);
        } finally {
            setSalvandoRegra(false);
        }
    };

    const handleIniciarEdicaoRegra = (regra) => {
        setRegraEmEdicaoId(regra.id);
        setFormRegra({
            termoDescricao: regra.termoDescricao || "",
            termoTipo: regra.termoTipo || "",
            fornecedorTexto: regra.nomeFornecedor || ""
        });
        setModoCadastroRegra(true);
    };

    const handleExcluirRegra = async (id) => {
        if (!window.confirm("Deseja realmente excluir esta regra?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/fornecedor/regras/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao excluir regra.");

            alert("Regra excluída com sucesso!");
            carregarRegras();
        } catch (err) {
            alert(err.message);
        }
    };

    // --- LÓGICA DE FILTRAGEM DE FORNECEDORES ---
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
        return Array.from(new Set(dados.map((b) => b.cpfCnpj || b.cpf_cnpj).filter(Boolean)));
    }, [fornecedores, filtros, mostrarInativos]);

    const schemaFiltroFornecedor = [
        { key: "nome", label: "Nome do Fornecedor", tipo: "inputlist", placeholder: "Buscar por Nome...", options: opcoesNome },
        { key: "cpfCnpj", label: "CPF/CNPJ", tipo: "inputlist", placeholder: "Buscar por CPF/CNPJ...", options: opcoesCpfCnpj }
    ];

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

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    nome: formFornecedor.nome.trim(),
                    cpfCnpj: formFornecedor.cpfCnpj.trim()
                })
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
        if (!window.confirm(`Deseja realmente ${isAtivo ? "desativar" : "reativar"} o fornecedor "${f.nome}"?`)) return;

        try {
            const res = await fetch(`${API_BASE}/api/fornecedor/${f.id}/status?ativo=${!isAtivo}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || resposta.mensagem || "Erro ao alterar status.");

            alert(resposta.mensagem || "Status atualizado com sucesso!");
            if (carregarFornecedores) carregarFornecedores();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasFornecedor = [
        {
            label: "Nome do Fornecedor",
            key: "nome",
            width: "45%",
            Cell: ({ row }) => (
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontWeight: "500" }}>{row.nome}</span>
                    {Number(row.status) === 2 && (
                        <span style={{ fontSize: "11px", backgroundColor: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px", fontWeight: "600" }}>
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
            Cell: ({ row }) => <span style={{ fontWeight: "600" }}>{row.cpfCnpj || row.cpf_cnpj || "-"}</span>
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
                        <Button onClick={() => handleIniciarEdicaoFornecedor(row)}>Editar</Button>
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

    // --- LÓGICA DE FILTRAGEM - REGRAS ---
    const handleFilterRegraChange = (key, value) => setFiltrosRegra((prev) => ({ ...prev, [key]: value }));
    const limparFiltrosRegra = () => setFiltrosRegra({ descricao: "", tipo: "", fornecedor: "" });

    const filtrarRegraExcecao = (chaveIgnorada) => {
        return regras.filter((item) => {
            const descricao = (item.termoDescricao || "- Qualquer -").toLowerCase();
            const tipo = (item.termoTipo || "- Qualquer -").toLowerCase();
            const fornecedor = (item.nomeFornecedor || "- Qualquer -").toLowerCase();

            return (
                (chaveIgnorada === "descricao" || descricao.includes(filtrosRegra.descricao.toLowerCase().trim())) &&
                (chaveIgnorada === "tipo" || tipo.includes(filtrosRegra.tipo.toLowerCase().trim())) &&
                (chaveIgnorada === "fornecedor" || fornecedor.includes(filtrosRegra.fornecedor.toLowerCase().trim()))
            );
        });
    };

    const schemaFiltroRegra = [
        { key: "descricao", label: "Descrição", tipo: "inputlist", placeholder: "Buscar descrição...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao("descricao").map((r) => r.termoDescricao || "- Qualquer -").filter(Boolean))), [regras, filtrosRegra]) },
        { key: "tipo", label: "Tipo", tipo: "inputlist", placeholder: "Buscar tipo...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao("tipo").map((r) => r.termoTipo || "- Qualquer -").filter(Boolean))), [regras, filtrosRegra]) },
        { key: "fornecedor", label: "Fornecedor", tipo: "inputlist", placeholder: "Buscar fornecedor...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao("fornecedor").map((r) => r.nomeFornecedor || "- Qualquer -").filter(Boolean))), [regras, filtrosRegra]) }
    ];

    const regrasFiltradas = useMemo(() => {
        return regras.filter((item) => {
            const descricao = (item.termoDescricao || "- Qualquer -").toLowerCase();
            const tipo = (item.termoTipo || "- Qualquer -").toLowerCase();
            const fornecedor = (item.nomeFornecedor || "- Qualquer -").toLowerCase();

            return (
                descricao.includes(filtrosRegra.descricao.toLowerCase().trim()) &&
                tipo.includes(filtrosRegra.tipo.toLowerCase().trim()) &&
                fornecedor.includes(filtrosRegra.fornecedor.toLowerCase().trim())
            );
        });
    }, [regras, filtrosRegra]);

    const colunasRegras = [
        { label: "Descrição", key: "termoDescricao", width: "30%", Cell: ({ row }) => row.termoDescricao || <span>- Qualquer -</span> },
        { label: "Tipo", key: "termoTipo", width: "30%", Cell: ({ row }) => row.termoTipo || <span>- Qualquer -</span> },
        { label: "Fornecedor", key: "nomeFornecedor", width: "25%", Cell: ({ row }) => row.nomeFornecedor || <span>- Qualquer -</span> },
        {
            label: "Ações",
            key: "acoes",
            width: "15%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <Button onClick={() => handleIniciarEdicaoRegra(row)}>Editar</Button>
                    <Button onClick={() => handleExcluirRegra(row.id)} style={{ backgroundColor: "#ef4444" }}>Excluir</Button>
                </div>
            )
        }
    ];

    const handleExportarFornecedor = () => {
        ExportarExcel({
            tabela: "fornecedor",
            colunas: ["FORNECEDOR", "CPF-CNPJ"],
            nomeArquivoCustomizado: "Mapa_Fornecedor.xlsx"
        });
    };

    const handleExportarRegrasFornecedor = () => {
        ExportarExcel({
            tabela: "fornecedorregras",
            colunas: ["DESCRICAO", "TIPO", "FORNECEDOR"],
            nomeArquivoCustomizado: "Regras_Fornecedor.xlsx"
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* 1. REGRAS DE MAPEAMENTO */}
            {!modoCadastroRegra ? (
                <Card title="Regras de Mapeamento de Fornecedores">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <p>Gerencie as regras automáticas de depara para fornecedores.</p>
                        <Button
                            onClick={() => {
                                setRegraEmEdicaoId(null);
                                setFormRegra({ termoDescricao: "", termoTipo: "", fornecedorTexto: "" });
                                setModoCadastroRegra(true);
                            }}
                        >
                            + Nova Regra
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <FiltroBar
                            schema={schemaFiltroRegra}
                            filtros={filtrosRegra}
                            onChange={handleFilterRegraChange}
                            onLimpar={limparFiltrosRegra}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", margin: "8px" }}>
                        <Button onClick={handleExportarRegrasFornecedor}>Baixar Tudo</Button>
                    </div>

                    {carregandoRegras ? (
                        <div style={{ padding: "20px", textAlign: "center" }}>Carregando regras...</div>
                    ) : (
                        <Table columns={colunasRegras} data={regrasFiltradas} />
                    )}
                </Card>
            ) : (
                <Card title={regraEmEdicaoId ? "Editar Regra de Mapeamento" : "Nova Regra de Mapeamento"}>
                    <form onSubmit={handleSalvarRegra} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        <div className="form-group">
                            <label className="form-label">Termo na Descrição</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: NOTA FISCAL"
                                value={formRegra.termoDescricao}
                                onChange={(e) => setFormRegra({ ...formRegra, termoDescricao: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Termo no Tipo</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: PIX, TED..."
                                value={formRegra.termoTipo}
                                onChange={(e) => setFormRegra({ ...formRegra, termoTipo: e.target.value })}
                            />
                        </div>
                        <div>
                            <Inputlist
                                id="regra-fornecedor"
                                label="Fornecedor *"
                                placeholder="Escolha o fornecedor..."
                                value={formRegra.fornecedorTexto}
                                onChange={(e) => setFormRegra({ ...formRegra, fornecedorTexto: e.target.value })}
                                options={fornecedores}
                                valueKey={(f) => f.nome || ""}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                            <Button type="button" onClick={() => setModoCadastroRegra(false)} disabled={salvandoRegra}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={salvandoRegra}>
                                {salvandoRegra ? "Salvando..." : "Salvar Regra"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* 2. CADASTRO DE FORNECEDOR */}
            {!modoCadastroFornecedor ? (
                <Card title="Gerenciamento de Fornecedores">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie os fornecedores cadastrados no sistema.</p>
                            <Button
                                onClick={() => setMostrarInativos(!mostrarInativos)}
                                style={{ backgroundColor: mostrarInativos ? "#ef4444" : "#35448a" }}
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
                        <FiltroBar
                            schema={schemaFiltroFornecedor}
                            filtros={filtros}
                            onChange={handleFilterChange}
                            onLimpar={limparFiltros}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", margin: "8px" }}>
                        <Button onClick={handleExportarFornecedor}>Baixar Tudo</Button>
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
                        <div className="form-group">
                            <label className="form-label">Nome do Fornecedor *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formFornecedor.nome}
                                onChange={(e) => setFormFornecedor({ ...formFornecedor, nome: e.target.value })}
                                placeholder="Ex: Fornecedor ABC"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">CPF/CNPJ do Fornecedor *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formFornecedor.cpfCnpj}
                                onChange={(e) => setFormFornecedor({ ...formFornecedor, cpfCnpj: e.target.value })}
                                placeholder="Ex: 00.000.000/0000-00"
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button type="button" onClick={() => setModoCadastroFornecedor(false)} disabled={carregando}>
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