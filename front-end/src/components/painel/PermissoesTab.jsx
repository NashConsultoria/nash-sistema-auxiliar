import { useState, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import Inputlist from "../Inputlist/Inputlist";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

export default function PermissoesTab({ token, usuarios = [], contratantes = [] }) {
    const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
    const [vinculosAtuais, setVinculosAtuais] = useState([]);
    const [termoBusca, setTermoBusca] = useState("");
    const [carregando, setCarregando] = useState(false);

    // --- ESTADOS DO FILTROBAR (LISTA DE FUNCIONÁRIOS) ---
    const [filtros, setFiltros] = useState({
        nome: '',
        email: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: '',
            email: ''
        });
    };

    // Apenas funcionários ativos (perfil 2 e status 1)
    const usuariosValidos = useMemo(() => {
        return usuarios.filter(u => Number(u.perfil) === 2 && Number(u.status) === 1);
    }, [usuarios]);

    // Lógica de opções dinâmicas estilo Excel ignorando o próprio campo
    const filtrarUsuariosExcecao = (chaveIgnorada) => {
        return usuariosValidos.filter((item) => {
            const nome = (item.nome || '').toLowerCase();
            const email = (item.email || '').toLowerCase();

            return (
                (chaveIgnorada === 'nome' || nome.includes(filtros.nome.toLowerCase().trim())) &&
                (chaveIgnorada === 'email' || email.includes(filtros.email.toLowerCase().trim()))
            );
        });
    };

    const opcoesNome = useMemo(() => {
        const dados = filtrarUsuariosExcecao('nome');
        return Array.from(new Set(dados.map(u => u.nome).filter(Boolean)));
    }, [usuariosValidos, filtros]);

    const opcoesEmail = useMemo(() => {
        const dados = filtrarUsuariosExcecao('email');
        return Array.from(new Set(dados.map(u => u.email).filter(Boolean)));
    }, [usuariosValidos, filtros]);

    // Schema do FiltroBar para a tabela de Usuários
    const schemaFiltroUsuarios = [
        {
            key: "nome",
            label: "Funcionário",
            tipo: "inputlist",
            placeholder: "Buscar por nome...",
            options: opcoesNome
        },
        {
            key: "email",
            label: "E-mail",
            tipo: "inputlist",
            placeholder: "Buscar por e-mail...",
            options: opcoesEmail
        }
    ];

    // Dados filtrados aplicados na tabela principal
    const usuariosFiltrados = useMemo(() => {
        return usuariosValidos.filter((item) => {
            const nome = (item.nome || '').toLowerCase();
            const email = (item.email || '').toLowerCase();

            return (
                nome.includes(filtros.nome.toLowerCase().trim()) &&
                email.includes(filtros.email.toLowerCase().trim())
            );
        });
    }, [usuariosValidos, filtros]);

    // Abre o gerenciador buscando quais contratantes o funcionário já acessa
    const handleAbrirGerenciador = async (funcionario) => {
        setFuncionarioSelecionado(funcionario);
        setCarregando(true);
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionario.id}/contratantes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar vínculos do funcionário.");
            const dados = await res.json();
            setVinculosAtuais(dados);
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    // Recarrega os vínculos atuais do funcionário selecionado
    const recarregarVinculos = async () => {
        if (!funcionarioSelecionado) return;
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionarioSelecionado.id}/contratantes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const dados = await res.json();
                setVinculosAtuais(dados);
            }
        } catch (err) {
            console.error("Erro ao recarregar vínculos:", err);
        }
    };

    // Adiciona um novo vínculo de contratante ao funcionário
    const handleAdicionarVinculo = async (contratanteId) => {
        if (!contratanteId) return;
        setCarregando(true);
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionarioSelecionado.id}/contratantes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contratanteId: Number(contratanteId) })
            });

            if (!res.ok) {
                const erro = await res.json();
                throw new Error(erro.detail || "Erro ao adicionar vínculo.");
            }

            setTermoBusca(""); // Limpa a busca
            await recarregarVinculos(); // Atualiza a tabela
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    // Evento disparado quando o usuário escolhe no datalist ou clica no botão Adicionar
    const handleConfirmarAdicao = () => {
        const encontrado = contratantes.find(
            c => c.nome.trim().toLowerCase() === termoBusca.trim().toLowerCase()
        );

        if (encontrado) {
            handleAdicionarVinculo(encontrado.id);
        } else {
            alert("Contratante não encontrado. Selecione uma opção válida da lista.");
        }
    };

    // Remove o vínculo de um contratante
    const handleRemoverVinculo = async (contratanteId) => {
        if (!window.confirm("Deseja realmente remover o acesso deste funcionário a este contratante?")) return;
        setCarregando(true);
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionarioSelecionado.id}/contratantes/${contratanteId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao remover vínculo.");
            await recarregarVinculos();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const colunasPermissoes = [
        {
            label: "Funcionário",
            key: "nome",
            width: "40%",
            Cell: ({ row }) => <span style={{ fontWeight: "500" }}>{row.nome}</span>
        },
        {
            label: "E-mail",
            key: "email",
            width: "40%"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <Button onClick={() => handleAbrirGerenciador(row)}>
                    Configurar Vínculos
                </Button>
            )
        }
    ];

    // Filtra contratantes que ainda NÃO estão vinculados a este funcionário
    const contratantesDisponiveis = contratantes.filter(
        c => !vinculosAtuais.some(v => Number(v.id) === Number(c.id))
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!funcionarioSelecionado ? (
                /* PASSO 1: LISTAR OS FUNCIONÁRIOS */
                <Card title="Permissões de Usuários">
                    <p style={{ marginBottom: "15px" }}>
                        Selecione um funcionário para gerenciar a quais contratantes ele tem acesso.
                    </p>

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
                        columns={colunasPermissoes}
                        data={usuariosFiltrados}
                    />
                </Card>
            ) : (
                /* PASSO 2: GERENCIAR VÍNCULOS DO FUNCIONÁRIO SELECIONADO */
                <Card title={`Permissões de: ${funcionarioSelecionado.nome}`}>
                    <div style={{ marginBottom: "20px" }}>
                        <Button onClick={() => {
                            setFuncionarioSelecionado(null);
                            setTermoBusca("");
                        }}>
                            ← Voltar para a lista
                        </Button>
                    </div>

                    {/* Formulário para Vincular Novo Contratante */}
                    <div style={{ marginBottom: "24px" }}>
                        <h4 style={{ margin: "0 0 10px 0" }}>Vincular a um Novo Contratante</h4>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <Inputlist
                                id="contratantes-permissoes"
                                placeholder="Pesquisar contratante para adicionar..."
                                value={termoBusca}
                                onChange={(e) => setTermoBusca(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleConfirmarAdicao();
                                }}
                                options={contratantesDisponiveis}
                                valueKey="nome"
                            />

                            <Button onClick={handleConfirmarAdicao} disabled={carregando || !termoBusca}>
                                {carregando ? "Adicionando..." : "Adicionar Vínculo"}
                            </Button>
                        </div>
                    </div>

                    {/* Tabela de Vínculos Atuais */}
                    <h4 style={{ margin: "0 0 10px 0" }}>Contratantes Vinculados atualmente:</h4>
                    {carregando && vinculosAtuais.length === 0 ? (
                        <p style={{ color: "#64748b" }}>Carregando vínculos...</p>
                    ) : vinculosAtuais.length === 0 ? (
                        <p style={{ color: "#64748b", fontStyle: "italic" }}>
                            Este funcionário não possui acesso a nenhum contratante ainda.
                        </p>
                    ) : (
                        <Table
                            columns={[
                                { label: "Contratante", key: "nome", width: "75%" },
                                {
                                    label: "Ações",
                                    key: "id",
                                    width: "25%",
                                    style: { textAlign: "right" },
                                    Cell: ({ row }) => (
                                        <Button
                                            onClick={() => handleRemoverVinculo(row.id)}
                                            style={{
                                                padding: "6px 12px",
                                                backgroundColor: "#ef444422",
                                                color: "#f87171",
                                                border: "1px solid #ef444444",
                                                borderRadius: "4px",
                                                cursor: "pointer"
                                            }}
                                        >
                                            Remover Acesso
                                        </Button>
                                    )
                                }
                            ]}
                            data={vinculosAtuais}
                        />
                    )}
                </Card>
            )}
        </div>
    );
}