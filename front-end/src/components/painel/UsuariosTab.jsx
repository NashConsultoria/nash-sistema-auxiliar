import { useState } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import { API_BASE } from "../../context/AuthContext";

// Dicionário de mapeamento local (ou importe do seu constants/perfis)
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

    // Dispara ao salvar (Cadastrar ou Editar)
    const handleSalvarUsuario = async (e) => {
        e.preventDefault();

        // VALIDAÇÃO: Se for Cliente (perfil 3), exige um contratante válido selecionado
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
                // Trata e-mail duplicado
                if (res.status === 400 && (resposta.detail?.toLowerCase().includes("email") || resposta.detail?.toLowerCase().includes("e-mail"))) {
                    throw new Error("⚠️ Este e-mail já está cadastrado em outro usuário. Por favor, utilize outro.");
                }

                // Trata validações do backend (FastAPI 422)
                if (res.status === 422 && resposta.detail) {
                    const erroMsg = Array.isArray(resposta.detail)
                        ? resposta.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n')
                        : JSON.stringify(resposta.detail);
                    throw new Error(`Erro de validação:\n${erroMsg}`);
                }

                throw new Error(resposta.detail || "Erro ao processar operação.");
            }

            // Atualiza o estado global se o usuário estiver editando a si mesmo
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
            width: "15%",
            Cell: ({ value }) => nomesPerfis[value] || "Desconhecido"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "right" },
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

                    <Table
                        columns={colunasUsuarios}
                        data={usuarios.filter((usr) => mostrarInativos ? true : Number(usr.status) === 1)}
                        getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                    />
                </Card>
            ) : (
                /* TELA 2: FORMULÁRIO DE CADASTRO/EDIÇÃO */
                <Card title={editandoId ? "Editar Usuário" : "Cadastrar Novo Usuário"}>
                    <form onSubmit={handleSalvarUsuario} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontWeight: "500" }}>Nome *</label>
                            <input
                                type="text"
                                required
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Nome completo"
                                style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#1e293b", color: "#fff" }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontWeight: "500" }}>E-mail *</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="exemplo@empresa.com"
                                style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#1e293b", color: "#fff" }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontWeight: "500" }}>
                                {editandoId ? "Senha (deixe em branco para manter a atual):" : "Senha *"}
                            </label>
                            <input
                                type="password"
                                required={!editandoId}
                                value={formData.senha}
                                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                placeholder="••••••••"
                                style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#1e293b", color: "#fff" }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontWeight: "500" }}>Tipo de Usuário:</label>
                            <select
                                value={formData.perfil}
                                disabled={
                                    String(usuario?.id) === String(editandoId) ||
                                    Number(editandoId) === 1
                                }
                                onChange={(e) => setFormData({ ...formData, perfil: e.target.value, contratanteId: "", contratanteTextoBusca: "" })}
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #475569",
                                    backgroundColor: (String(usuario?.id) === String(editandoId) || Number(editandoId) === 1) ? "#334155" : "#1e293b",
                                    color: (String(usuario?.id) === String(editandoId) || Number(editandoId) === 1) ? "#94a3b8" : "#fff",
                                    cursor: (String(usuario?.id) === String(editandoId) || Number(editandoId) === 1) ? "not-allowed" : "pointer"
                                }}
                            >
                                <option value="1">Administrador</option>
                                <option value="2">Funcionário</option>
                                <option value="3">Cliente</option>
                            </select>
                        </div>

                        {/* Busca condicional de Contratante para tipo Cliente */}
                        {formData.perfil === "3" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontWeight: "500" }}>
                                    Pesquisar Contratante Vinculado *
                                </label>
                                <input
                                    type="text"
                                    list="contratantes-usuarios-list"
                                    placeholder="Digite o nome para buscar..."
                                    value={formData.contratanteTextoBusca}
                                    onChange={(e) => {
                                        const valorDigitado = e.target.value;
                                        const encontrado = contratantes.find(
                                            (c) => c.nome.trim().toLowerCase() === valorDigitado.trim().toLowerCase()
                                        );

                                        setFormData({
                                            ...formData,
                                            contratanteTextoBusca: valorDigitado,
                                            contratanteId: encontrado ? encontrado.id : ""
                                        });
                                    }}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: "6px",
                                        border: formData.contratanteId ? "1px solid #22c55e" : "1px solid #475569",
                                        backgroundColor: "#1e293b",
                                        color: "#fff"
                                    }}
                                />
                                <datalist id="contratantes-usuarios-list">
                                    {contratantes.filter(c => Number(c.status) === 1).map((c) => (
                                        <option key={c.id} value={c.nome} />
                                    ))}
                                </datalist>
                                {formData.contratanteId ? (
                                    <span style={{ fontSize: "12px", color: "#4ade80" }}>✓ Contratante selecionado</span>
                                ) : (
                                    <span style={{ fontSize: "12px", color: "#f87171" }}>⚠️ Selecione um contratante da lista sugerida</span>
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