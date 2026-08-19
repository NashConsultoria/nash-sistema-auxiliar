import { useState, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import Inputlist from "../Inputlist/Inputlist";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

// Dicionário de mapeamento local
const nomesPerfis = {
    1: "Administrador",
    2: "Funcionário",
    3: "Cliente"
};

export default function UsuariosTab({ usuario, setUsuario, token, contratantes = [], usuarios = [], carregarUsuarios }) {
    const [modoCadastro, setModoCadastro] = useState(false);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [carregando, setCarregando] = useState(false);
    
    const [formData, setFormData] = useState({
        nome: "",
        email: "",
        senha: "",
        perfil: "1",
        contratanteId: "",
        contratanteTextoBusca: ""
    });

    // --- ESTADOS DO FILTROBAR ---
    const [filtros, setFiltros] = useState({
        nome: '',
        email: '',
        perfil: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: '',
            email: '',
            perfil: ''
        });
    };

    // --- LÓGICA DE FILTRAGEM DINÂMICA (EXCEL STYLE) ---
    const filtrarUsuariosExcecao = (chaveIgnorada) => {
        return usuarios.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const perfilTexto = (nomesPerfis[item.perfil] || '').toLowerCase();

            return (
                passaStatus &&
                (chaveIgnorada === 'nome' || nome.includes(filtros.nome.toLowerCase().trim())) &&
                (chaveIgnorada === 'email' || email.includes(filtros.email.toLowerCase().trim())) &&
                (chaveIgnorada === 'perfil' || perfilTexto.includes(filtros.perfil.toLowerCase().trim()))
            );
        });
    };

    const opcoesNome = useMemo(() => {
        const dados = filtrarUsuariosExcecao('nome');
        return Array.from(new Set(dados.map(u => u.nome).filter(Boolean)));
    }, [usuarios, filtros, mostrarInativos]);

    const opcoesEmail = useMemo(() => {
        const dados = filtrarUsuariosExcecao('email');
        return Array.from(new Set(dados.map(u => u.email).filter(Boolean)));
    }, [usuarios, filtros, mostrarInativos]);

    const opcoesPerfil = useMemo(() => {
        const dados = filtrarUsuariosExcecao('perfil');
        return Array.from(new Set(dados.map(u => nomesPerfis[u.perfil]).filter(Boolean)));
    }, [usuarios, filtros, mostrarInativos]);

    // Schema do FiltroBar para Usuários
    const schemaFiltroUsuarios = [
        {
            key: "nome",
            label: "Nome",
            tipo: "inputlist",
            placeholder: "Buscar por Nome...",
            options: opcoesNome
        },
        {
            key: "email",
            label: "E-mail",
            tipo: "inputlist",
            placeholder: "Buscar por E-mail...",
            options: opcoesEmail
        },
        {
            key: "perfil",
            label: "Perfil",
            tipo: "inputlist",
            placeholder: "Buscar por Perfil...",
            options: opcoesPerfil
        }
    ];

    // Dados filtrados aplicados na tabela principal
    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const perfilTexto = (nomesPerfis[item.perfil] || '').toLowerCase();

            return (
                passaStatus &&
                nome.includes(filtros.nome.toLowerCase().trim()) &&
                email.includes(filtros.email.toLowerCase().trim()) &&
                perfilTexto.includes(filtros.perfil.toLowerCase().trim())
            );
        });
    }, [usuarios, filtros, mostrarInativos]);

    // Dispara ao salvar (Cadastrar ou Editar)
    const handleSalvarUsuario = async (e) => {
        e.preventDefault();

        if (formData.perfil === "3" && !formData.contratanteId) {
            alert("Por favor, selecione um contratante válido da lista antes de salvar.");
            return;
        }

        if (!editandoId && !formData.senha) {
            alert("A senha é obrigatória para novos cadastros.");
            return;
        }

        setCarregando(true);

        const url = editandoId ? `${API_BASE}/api/usuarios/${editandoId}` : `${API_BASE}/api/usuarios`;
        const metodo = editandoId ? "PUT" : "POST";

        const statusAtual = editandoId
            ? Number(usuarios.find(u => u.id === editandoId)?.status || 1)
            : 1;

        const payload = {
            nome: formData.nome.trim(),
            email: formData.email.trim(),
            perfil: parseInt(formData.perfil),
            contratanteId: formData.perfil === "3" ? parseInt(formData.contratanteId) : null,
            status: statusAtual,
            ...(formData.senha && { senha: formData.senha })
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

            if (!res.ok) {
                if (res.status === 400 && (resposta.detail?.toLowerCase().includes("email") || resposta.detail?.toLowerCase().includes("e-mail"))) {
                    throw new Error("⚠️ Este e-mail já está cadastrado em outro usuário. Por favor, utilize outro.");
                }

                if (res.status === 422 && resposta.detail) {
                    const erroMsg = Array.isArray(resposta.detail)
                        ? resposta.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n')
                        : JSON.stringify(resposta.detail);
                    throw new Error(`Erro de validação:\n${erroMsg}`);
                }

                throw new Error(resposta.detail || "Erro ao processar operação.");
            }

            if (editandoId && Number(editandoId) === Number(usuario?.id) && setUsuario) {
                setUsuario({
                    ...usuario,
                    nome: formData.nome,
                    email: formData.email,
                    perfil: parseInt(formData.perfil),
                    contratanteId: formData.perfil === "3" ? parseInt(formData.contratanteId) : null,
                });
            }

            alert(resposta.detail || "Usuário salvo com sucesso!");
            setModoCadastro(false);
            if (carregarUsuarios) carregarUsuarios();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    // Preenche os campos ao clicar em Editar
    const handleIniciarEdicao = (usr) => {
        const contratanteAtual = contratantes.find(c => Number(c.id) === Number(usr.contratanteId));
        setFormData({
            nome: usr.nome || "",
            email: usr.email || "",
            senha: "",
            perfil: String(usr.perfil),
            contratanteId: usr.contratanteId || "",
            contratanteTextoBusca: contratanteAtual ? contratanteAtual.nome : ""
        });
        setEditandoId(usr.id);
        setModoCadastro(true);
    };

    // Alternar Status (Ativar/Inativar)
    const handleAlternarStatus = async (usr) => {
        const { id, status, nome } = usr;
        const isAtivo = Number(status) === 1;

        const acao = isAtivo ? "desativar" : "reativar";
        const confirmacao = window.confirm(
            isAtivo
                ? `Tem certeza que deseja desativar o usuário "${nome}"? Ele perderá o acesso imediatamente.`
                : `Tem certeza que deseja reativar o usuário "${nome}"?`
        );

        if (!confirmacao) return;

        try {
            let res;
            if (isAtivo) {
                res = await fetch(`${API_BASE}/api/usuarios/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                res = await fetch(`${API_BASE}/api/usuarios/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        nome: usr.nome,
                        email: usr.email,
                        senha: "",
                        perfil: usr.perfil,
                        contratanteId: usr.contratanteId,
                        status: 1
                    })
                });
            }

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || `Erro ao ${acao} usuário.`);

            alert(isAtivo ? (resposta.detail || "Usuário desativado!") : "Usuário reativado com sucesso!");
            if (carregarUsuarios) carregarUsuarios();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasUsuarios = [
        {
            label: "Nome",
            key: "nome",
            width: "30%",
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
            label: "E-mail",
            key: "email",
            width: "35%"
        },
        {
            label: "Perfil",
            key: "perfil",
            width: "20%",
            Cell: ({ value }) => nomesPerfis[value] || "Desconhecido"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "15%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button onClick={() => handleIniciarEdicao(row)}>
                        Editar
                    </Button>

                    {Number(row.protegido) !== 1 && (
                        <Button
                            onClick={() => handleAlternarStatus(row)}
                            style={{
                                backgroundColor: Number(row.status) === 1 ? "#ef444422" : "#22c55e22",
                                color: Number(row.status) === 1 ? "#f87171" : "#4ade80",
                            }}
                        >
                            {Number(row.status) === 1 ? "Inativar" : "Reativar"}
                        </Button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastro ? (
                /* TELA 1: LISTAGEM VISUAL */
                <Card title="Gerenciamento de Usuários">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p style={{ margin: 0 }}>Visualize e gerencie os acessos do sistema.</p>
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
                                setEditandoId(null);
                                setFormData({ nome: "", email: "", senha: "", perfil: "1", contratanteId: "", contratanteTextoBusca: "" });
                                setModoCadastro(true);
                            }}
                        >
                            + Cadastrar Novo Usuário
                        </Button>
                    </div>

                    {/* BARRA DE FILTROS */}
                    <div className="card-filtros mb-4">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltroUsuarios}
                                filtros={filtros}
                                onChange={handleFilterChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>

                    <Table
                        columns={colunasUsuarios}
                        data={usuariosFiltrados}
                        getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                    />
                </Card>
            ) : (
                /* TELA 2: FORMULÁRIO DE CADASTRO/EDIÇÃO */
                <Card title={editandoId ? "Editar Usuário" : "Cadastrar Novo Usuário"}>
                    <form onSubmit={handleSalvarUsuario} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label className="form-label">Nome *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Nome completo"
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label className="form-label">E-mail *</label>
                            <input
                                type="email"
                                className="form-input"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="exemplo@empresa.com"
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label className="form-label">
                                {editandoId ? "Senha (deixe em branco para manter a atual):" : "Senha *"}
                            </label>
                            <input
                                type="password"
                                className="form-input"
                                required={!editandoId}
                                value={formData.senha}
                                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                placeholder="••••••••"
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label className="form-label">Tipo de Usuário:</label>
                            <select
                                value={formData.perfil}
                                className="form-input"
                                disabled={
                                    String(usuario?.id) === String(editandoId) ||
                                    Number(editandoId) === 1
                                }
                                onChange={(e) => setFormData({ ...formData, perfil: e.target.value, contratanteId: "", contratanteTextoBusca: "" })}
                            >
                                <option value="1">Administrador</option>
                                <option value="2">Funcionário</option>
                                <option value="3">Cliente</option>
                            </select>
                        </div>

                        {/* Busca condicional de Contratante para tipo Cliente */}
                        {formData.perfil === "3" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <Inputlist
                                    id="contratantes-usuarios"
                                    label="Pesquisar Contratante Vinculado *"
                                    placeholder="Digite o nome para buscar..."
                                    value={formData.contratanteTextoBusca}
                                    onChange={(e) => {
                                        const valorDigitado = e.target.value;
                                        const encontrado = contratantes.find(
                                            (c) => (c.nome || c.razaoSocial || "").trim().toLowerCase() === valorDigitado.trim().toLowerCase()
                                        );

                                        setFormData((prev) => ({
                                            ...prev,
                                            contratanteTextoBusca: valorDigitado,
                                            contratanteId: encontrado ? encontrado.id : ""
                                        }));
                                    }}
                                    options={contratantes.filter((c) => Number(c.status) === 1)}
                                    valueKey={(c) => c.nome || c.razaoSocial || ""}
                                />
                                {formData.contratanteId ? (
                                    <span style={{ color: "#4ade80" }}>✓ Contratante selecionado</span>
                                ) : (
                                    <span style={{ color: "#f87171" }}>⚠️ Selecione um contratante da lista sugerida</span>
                                )}
                            </div>
                        )}

                        {/* Botões de Ação */}
                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastro(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Usuário"}
                            </Button>
                        </div>

                    </form>
                </Card>
            )}
        </div>
    );
}