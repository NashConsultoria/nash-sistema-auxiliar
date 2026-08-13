import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../components/PainelControle.css"; 
import Card from "../components/card/Card";
import Button from "../components/button/Button"
import Table from "../components/table/Table"
import { API_BASE } from "../context/AuthContext";
import { ExportarExcel } from "../utils/ExportarExcel";
import { useAuth } from "../context/AuthContext";
import { CiSettings, CiLogout } from "react-icons/ci";
import { FaUsers } from "react-icons/fa6";
import { FaUser, FaHistory  } from "react-icons/fa";
import { IoMdSettings } from "react-icons/io";
import { GrUserManager } from "react-icons/gr";
import { BiImport } from "react-icons/bi";

export default function PainelControle() {
    const navigate = useNavigate();
    const { logout, usuario, setUsuario, token } = useAuth();

    const banco = usuario?.banco || "NashBancoConsultoria";

    // Estados de navegação das abas
    const [abaAtiva, setAbaAtiva] = useState("perfil");
    const [modoCadastro, setModoCadastro] = useState(false);
    const [mostrarInativos, setMostrarInativos] = useState(false);

    const colunasUsuarios = [
        {
            label: "Nome",
            key: "nome",
            width: "30%", // Distribui melhor o espaço da tabela
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
    
    const [contratantes, setContratantes] = useState([]);

    const carregarContratantes = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/contratantes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar contratantes");
            const dados = await res.json();
            setContratantes(dados);
        } catch (err) {
            console.error("Erro contratantes:", err);
        }
    };

    const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
    const [vinculosAtuais, setVinculosAtuais] = useState([]); // Contratantes vinculados ao funcionário selecionado

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
            style: { textAlign: "right" },
            Cell: ({ row }) => (
                <Button 
                    onClick={() => handleAbrirGerenciador(row)}
                >
                    Configurar Vínculos
                </Button>
            )
        }
    ];

    // Abre o gerenciador buscando quais contratantes o funcionário já acessa
    const handleAbrirGerenciador = async (funcionario) => {
        setFuncionarioSelecionado(funcionario);
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionario.id}/contratantes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar vínculos");
            const dados = await res.json();
            setVinculosAtuais(dados);
        } catch (err) {
            alert(err.message);
        }
    };

    // Adiciona um novo vínculo de contratante ao funcionário
    const handleAdicionarVinculo = async (contratanteId) => {
        if (!contratanteId) return;
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionarioSelecionado.id}/contratantes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ contratanteId: parseInt(contratanteId) })
            });
            if (!res.ok) {
                const erro = await res.json();
                throw new Error(erro.detail || "Erro ao adicionar vínculo.");
            }
            // Recarrega a lista de vínculos atualizada
            handleAbrirGerenciador(funcionarioSelecionado);
        } catch (err) {
            alert(err.message);
        }
    };

    // Remove o vínculo de um contratante
    const handleRemoverVinculo = async (contratanteId) => {
        if (!window.confirm("Deseja realmente remover o acesso deste funcionário a este contratante?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/usuarios/${funcionarioSelecionado.id}/contratantes/${contratanteId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao remover vínculo");
            handleAbrirGerenciador(funcionarioSelecionado);
        } catch (err) {
            alert(err.message);
        }
    };

    // Estados para o Gerenciamento de Contratantes
    const [modoCadastroContratante, setModoCadastroContratante] = useState(false);
    const [editandoContratanteId, setEditandoContratanteId] = useState(null);
    const [mostrarContratantesInativos, setMostrarContratantesInativos] = useState(false);
    const [formContratante, setFormContratante] = useState({ nome: "", banco: "" });

    // Colunas específicas para a tabela de Contratantes
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
                            fontSize: "11px", backgroundColor: "#ef4444", color: "#fff", 
                            padding: "2px 6px", borderRadius: "4px", marginLeft: "8px", fontWeight: "600" 
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
            style: { textAlign: "right" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button 
                        onClick={() => handleIniciarEdicaoContratante(row)}>
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

    const handleSalvarContratante = async (e) => {
        e.preventDefault();
        
        // Validação básica: apenas Nome é obrigatório
        if (!formContratante.nome.trim()) {
            alert("O Nome do Contratante é obrigatório.");
            return;
        }

        const url = editandoContratanteId ? `${API_BASE}/api/contratantes/${editandoContratanteId}` : `${API_BASE}/api/contratantes`;
        const metodo = editandoContratanteId ? "PUT" : "POST";

        const statusAtual = editandoContratanteId 
            ? Number(contratantes.find(c => c.id === editandoContratanteId)?.status || 1) 
            : 1;

        const payload = {
            nome: formContratante.nome,
            // Envia null se a razão social estiver vazia ou com espaços em branco
            razaoSocial: formContratante.razaoSocial?.trim() ? formContratante.razaoSocial.trim() : null,
            status: statusAtual
        };

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar contratante");

            alert("Contratante salvo com sucesso!");
            setModoCadastroContratante(false);
            carregarContratantes(); // Recarrega a listagem
        } catch (err) {
            alert(err.message);
        }
    };

    const handleIniciarEdicaoContratante = (contratante) => {
        setFormContratante({
            nome: contratante.nome || "",
            razaoSocial: contratante.razaoSocial || ""
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
                    ...( !isAtivo && { "Content-Type": "application/json" }),
                    Authorization: `Bearer ${token}` 
                },
                ...(!isAtivo && { body: JSON.stringify({ ...contratante, status: 1 }) })
            });
            if (!res.ok) throw new Error("Erro ao alterar status do contratante");
            
            alert("Status atualizado!");
            carregarContratantes();
        } catch (err) {
            alert(err.message);
        }
    };

    const [lotes, setLotes] = useState([]);
    const [carregandoLotes, setCarregandoLotes] = useState(false);

    // 1. Função para carregar os lotes da API
    const carregarLotes = async () => {
        setCarregandoLotes(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/lotes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar lotes");
            
            const dados = await res.json();
            
            if (dados.sucesso) {
                setLotes(dados.lotes);
            }
        } catch (err) {
            console.error("Erro lotes:", err);
        } finally {
            setCarregandoLotes(false);
        }
    };

    // 2. Função para exportar os lotes
    const handleExportarLote = (row) => {
        // Tratamento para garantir que o arquivo exportado mantenha o nome original com a extensão .xlsx
        const nomeOriginal = row.nomeArquivo ? row.nomeArquivo.replace(/\.[^/.]+$/, "") : `Lote_${row.id}`;
        const nomeArquivoDownload = `${nomeOriginal}.xlsx`;

        // 1. Identifica se é o lote do Plano de Contas
        const ehPlanoContas = 
            row.nomeArquivo?.toLowerCase().includes("plano") || 
            row.contratante === "PLANO DE CONTAS (SISTEMA)";

        // 2. Identifica se é Folha de Pagamento
        const ehFolhaPagamento = 
            row.nomeArquivo?.toLowerCase().includes("folha") || 
            row.tipoLote?.toLowerCase().includes("folha") ||
            row.contratante?.toLowerCase().includes("folha");

        if (ehPlanoContas) {
            ExportarExcel({
                tabela: "planocontas",
                colunas: [
                    "PLANO DE CONTAS", 
                    "GRUPO DE CONTAS",
                    "edre", 
                    "dfc",
                    "efolha"
                ],
                nomeArquivoCustomizado: nomeArquivoDownload
            });
        } else if (ehFolhaPagamento) {
            ExportarExcel({
                tabela: "movimentacaofolhapagamento",
                colunaFiltro: "importacaoLoteId",
                valorFiltro: row.id,
                colunas: [
                    "CONTRATANTE",
                    "UNIDADE REGISTRO",
                    "UNIDADE ATUACAO",
                    "CNPJ",
                    "NOME",
                    "CPF",
                    "DATA NASCIMENTO",
                    "CBO CARGO",
                    "CARGO",
                    "DEPARTAMENTO",
                    "DATA ADMISSAO",
                    "DESCRICAO",
                    "PLANO DE CONTA",
                    "GRUPO DE CONTA",
                    "E-FOLHA",
                    "DATA COMPETENCIA",
                    "DATA CAIXA",
                    "TIPO",
                    "VALOR"
                ],
                nomeArquivoCustomizado: nomeArquivoDownload
            });
        } else {
            // Movimentação padrão
            ExportarExcel({
                tabela: "movimentacao",
                colunaFiltro: "importacaoLoteId",
                valorFiltro: row.id,
                colunas: [
                    "CONTRATANTE",
                    "UNIDADE",
                    "BANCO",
                    "AGENCIA",
                    "CONTA",
                    "DATA",
                    "DESCRICAO",
                    "OBSERVACAO",
                    "VALOR",
                    "TIPO",
                    "FORNECEDORES",
                    "CPF_CNPJ",
                    "PLANO DE CONTA",
                    "GRUPO DE CONTA",
                    "E-DRE"
                ],
                nomeArquivoCustomizado: nomeArquivoDownload
            });
        }
    };

    // 3. Função para excluir um lote
    const handleDeletarLote = async (loteId, nomeArquivo) => {
        const confirmou = window.confirm(
            `Tem certeza que deseja excluir o lote "${nomeArquivo}"? \nTodas as movimentações e cadastros órfãos deste lote serão removidos!`
        );

        if (!confirmou) return;

        try {
            const res = await fetch(`${API_BASE}/api/${banco}/lotes/${loteId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            const dados = await res.json();

            if (res.ok && dados.sucesso) {
                alert(dados.mensagem);
                carregarLotes();
            } else {
                alert(`Erro: ${dados.mensagem || "Não foi possível excluir o lote."}`);
            }
        } catch (err) {
            console.error("Erro ao deletar lote:", err);
            alert("Erro de conexão ao tentar excluir o lote.");
        }
    };

    // 3. Definição das Colunas da Tabela de Lotes
    const colunasLotes = [
        { label: "ID", key: "id", width: "10%" },
        { label: "Arquivo", key: "nomeArquivo", width: "25%" },
        { label: "Contratante", key: "contratante", width: "20%" },
        { label: "Data Importação", key: "criadoEm", width: "20%" },
        { label: "Linhas", key: "totalMovimentacoes", width: "10%" },
        {
            label: "Ações",
            key: "acoes",
            width: "15%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button
                        onClick={() => handleExportarLote(row)}
                        style={{
                            backgroundColor: "#3b82f622",
                            color: "#60a5fa",
                            border: "1px solid #3b82f644",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        Baixar
                    </Button>
                    
                    <Button
                        onClick={() => handleDeletarLote(row.id, row.nome_arquivo || row.nomeArquivo)}
                        style={{
                            backgroundColor: "#ef444422",
                            color: "#f87171",
                            border: "1px solid #ef444444",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        Excluir
                    </Button>

                </div>
            )
        }
    ];

    useEffect(() => {
        if (abaAtiva === "lotes" && token) {
            carregarLotes();
        }
    }, [abaAtiva, token]);

    const [logs, setLogs] = useState([]);
    const [carregandoLogs, setCarregandoLogs] = useState(false);

    // Busca os logs sempre que a aba "logs" for selecionada
    useEffect(() => {
        if (abaAtiva === "logs" && token) {
            setCarregandoLogs(true);
            fetch(`${API_BASE}/api/logs`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((res) => {
                    if (!res.ok) throw new Error("Erro ao carregar logs");
                    return res.json();
                })
                .then((data) => setLogs(data))
                .catch((err) => console.error(err))
                .finally(() => setCarregandoLogs(false));
        }
    }, [abaAtiva, token]);

    const colunasLogs = [
        {
            label: "Data/Hora",
            key: "criado_em",
            width: "20%",
            Cell: ({ row }) => new Date(row.criado_em).toLocaleString("pt-BR")
        },
        {
            label: "Usuário",
            key: "usuario_nome",
            width: "25%",
            Cell: ({ row }) => (
                <div>
                    <div style={{ fontWeight: "600" }}>{row.usuario_nome}</div>
                    <div style={{ fontSize: "12px"}}>{row.usuario_email}</div>
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
            width: "20%",
            Cell: ({ row }) => row.detalhes ? (
                <div style={{ 
                    backgroundColor: "rgba(0, 0, 0, 0.04)", // Fundo sutil em qualquer tema
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
                    color: "inherit" // Garante que a cor do texto acompanhe a tabela/hover
                }}>
                    {JSON.stringify(row.detalhes, null, 2)}
                </div>
            ) : (
                <span style={{ color: "#94a3b8", fontSize: "12px", italic: "true" }}>-</span>
            )
        }
    ];
    
    const [usuarios, setUsuarios] = useState([]);
    const [editandoId, setEditandoId] = useState(null);
    const [formData, setFormData] = useState({
        nome: "",
        email: "",
        senha: "",
        perfil: "1",
        contratanteId: "",
        contratanteTextoBusca: ""
    });

    const nomesPerfis = {
        1: "Administrador",
        2: "Funcionário",
        3: "Cliente"
    };

    // 1. Carrega a lista do backend
    const carregarUsuarios = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/usuarios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar usuários");
            const dados = await res.json();
            setUsuarios(dados);
        } catch (err) {
            alert(err.message);
        }
    };

    // 2. Dispara ao salvar (Cadastrar ou Editar)
    const handleSalvarUsuario = async (e) => {
        e.preventDefault();

        // VALIDAÇÃO: Se for Cliente (perfil 3), exige um contratante válido selecionado
        if (formData.perfil === "3" && !formData.contratanteId) {
            alert("Por favor, selecione um contratante válido da lista antes de salvar.");
            return;
        }

        const url = editandoId ? `${API_BASE}/api/usuarios/${editandoId}` : `${API_BASE}/api/usuarios`;
        const metodo = editandoId ? "PUT" : "POST";

        const statusAtual = editandoId 
            ? Number(usuarios.find(u => u.id === editandoId)?.status || 1) 
            : 1;

        const payload = {
            nome: formData.nome,
            email: formData.email,
            perfil: parseInt(formData.perfil),
            contratanteId: formData.perfil === "3" ? parseInt(formData.contratanteId) : null,
            status: statusAtual,
            ...(formData.senha && { senha: formData.senha }) 
        };

        if (!editandoId && !formData.senha) {
            alert("A senha é obrigatória para novos cadastros.");
            return;
        }

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
                // 1. Trata o erro de e-mail duplicado de forma amigável se o backend retornar 400
                if (res.status === 400 && (resposta.detail?.toLowerCase().includes("email") || resposta.detail?.toLowerCase().includes("e-mail"))) {
                    throw new Error("⚠️ Este e-mail já está cadastrado em outro usuário. Por favor, utilize outro.");
                }

                // 2. Trata erros de validação padrão do FastAPI (422)
                if (res.status === 422 && resposta.detail) {
                    const erroMsg = Array.isArray(resposta.detail)
                        ? resposta.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n')
                        : JSON.stringify(resposta.detail);
                    throw new Error(`Erro de validação:\n${erroMsg}`);
                }

                throw new Error(resposta.detail || "Erro na operação");
            }

            if (editandoId && Number(editandoId) === Number(usuario?.id)) {
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
            carregarUsuarios(); 
        } catch (err) {
            // Exibe a mensagem de erro amigável gerada acima
            alert(err.message);
        }
    };

    // 3. Preenche os campos ao clicar em Editar
    const handleIniciarEdicao = (usr) => {
        const contratanteAtual = contratantes.find(c => c.id === usr.contratanteId);
        setFormData({
            nome: usr.nome,
            email: usr.email,
            senha: "", 
            perfil: String(usr.perfil),
            contratanteId: usr.contratanteId || "",
            contratanteTextoBusca: contratanteAtual ? contratanteAtual.nome : ""
        });
        setEditandoId(usr.id);
        setModoCadastro(true);
    };

    // 4. Altera entre Ativo/Inativo (Exclusão Lógica)
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
                // Se está ativo, mantém o DELETE que altera o status para 2
                res = await fetch(`${API_BASE}/api/usuarios/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                // Se está inativo, chama a rota de edição normal enviando os dados dele + status 1
                res = await fetch(`${API_BASE}/api/usuarios/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        nome: usr.nome,
                        email: usr.email,
                        senha: "", // Senha vazia para manter a atual, conforme seu main.py trata
                        perfil: usr.perfil,
                        contratanteId: usr.contratanteId,
                        status: 1 // Força o status ativo de volta
                    })
                });
            }

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || `Erro ao ${acao} usuário.`);

            alert(isAtivo ? (resposta.detail || "Usuário desativado!") : "Usuário reativado com sucesso!");
            carregarUsuarios(); 
        } catch (err) {
            alert(err.message);
        }
    };

    useEffect(() => {
        if (usuario && (usuario.perfil === 1 || usuario.protegido === 1)) {
            carregarUsuarios();
            carregarContratantes();
            carregarLotes();
        }
    }, [usuario]);

    const handleLogout = () => {
        if (window.confirm("Deseja realmente sair do sistema?")) {
            logout();
            navigate("/login"); 
        }
    };

    return (
        <div className="usuario-page-layout">
            {/* CARD DA ESQUERDA - MENU */}
            <aside className="page-sidebar">
                <Card title="Painel de Controle">
                    <div className="sidebar-menu">
                        <Button 
                            className={`menu-btn ${abaAtiva === "perfil" ? "active" : ""}`}
                            onClick={() => setAbaAtiva("perfil")}
                        >
                            <FaUser size={20} />
                            <span>Perfil</span>
                        </Button>

                        {/* Apenas exibe a aba de Usuários se for Administrador (perfil 1) ou o Admin Supremo (id 1) */}
                        {(usuario?.perfil === 1 || usuario?.id === 1) && (
                            <>
                            <Button 
                                className={`menu-btn ${abaAtiva === "usuarios" ? "active" : ""}`}
                                onClick={() => setAbaAtiva("usuarios")}
                            >
                                <FaUsers size={20} />
                                <span>Usuários</span>
                            </Button>
                            <Button 
                                className={`menu-btn ${abaAtiva === "permissoes" ? "active" : ""}`}
                                onClick={() => setAbaAtiva("permissoes")}
                            >
                                <IoMdSettings size={20} />
                                <span>Gerenciar Permissões</span>
                            </Button>

                            <Button 
                                className={`menu-btn ${abaAtiva === "contratantes" ? "active" : ""}`}
                                onClick={() => setAbaAtiva("contratantes")}
                            >
                                <GrUserManager size={20} />
                                <span>Contratantes</span>
                            </Button>

                            <Button 
                                className={`menu-btn ${abaAtiva === "lotes" ? "active" : ""}`}
                                onClick={() => setAbaAtiva("lotes")}
                            >
                                <BiImport  size={20} />
                                <span>Lotes de Importações</span>
                            </Button>

                            <Button 
                                className={`menu-btn ${abaAtiva === "logs" ? "active" : ""}`}
                                onClick={() => setAbaAtiva("logs")}
                            >
                                <FaHistory size={20} />
                                <span>Logs</span>
                            </Button>
                            </>
                        )}
                        

                        <Button className="menu-btn logout" onClick={handleLogout}>
                            <CiLogout size={20} />
                            <span>Sair</span>
                        </Button>
                    </div>
                </Card>
            </aside>

            {/* CONTEÚDO DA DIREITA - DINÂMICO */}
            <main className="page-main-content">
                {abaAtiva === "perfil" && (
                    <Card title="Meu Perfil">
                        <div className="perfil-info">
                            <p><strong>Nome:</strong> {usuario?.nome || "Administrador Supremo"}</p>
                            <p>
                                <strong>Nível de Acesso:</strong> {
                                    usuario?.id === 1 
                                        ? "Administrador Supremo" 
                                        : (nomesPerfis[usuario?.perfil] || "Não Identificado")
                                }
                            </p>
                            <p><strong>Contratante:</strong> {usuario?.perfil === 3 ? (usuario?.nome_contratante || "Não Vinculado") : "N/A"}</p>
                        </div>
                    </Card>
                )}

                {abaAtiva === "usuarios" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {/* Usamos estados locais para controlar o fluxo visual do cadastro */}

                        {!modoCadastro ? (
                            /* TELA 1: LISTAGEM VISUAL (Padrão) */
                            <Card title="Gerenciamento de Usuários">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                        <p>Visualize e gerencie os acessos do sistema.</p>
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
                            /* TELA 2: FORMULÁRIO DE CADASTRO */
                            <Card title={editandoId ? "Editar Usuário" : "Cadastrar Novo Usuário"}>
                                <form onSubmit={handleSalvarUsuario} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                                    
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <label style={{ fontWeight: "500" }}>Nome:</label>
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
                                        <label style={{ fontWeight: "500" }}>E-mail:</label>
                                        <input 
                                            type="email" 
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="exemplo@nash.com"
                                            style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#1e293b", color: "#fff" }}
                                        />
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <label style={{ fontWeight: "500" }}>Senha:</label>
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
                                            /* 
                                            Bloqueia se:
                                            1. O usuário editado for o PRÓPRIO usuário logado (ninguém altera o próprio perfil)
                                            2. O usuário editado for o Admin Supremo (editandoId === 1)
                                            */
                                            disabled={
                                                String(usuario?.id) === String(editandoId) || 
                                                Number(editandoId) === 1
                                            }
                                            onChange={(e) => setFormData({ ...formData, perfil: e.target.value })}
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

                                    {/* Exibe condicionalmente a barra de pesquisa se for tipo Cliente (3) */}
                                    {formData.perfil === "3" && (
                                    <div style={{ marginBottom: "16px" }}>
                                        <label style={{ display: "block", marginBottom: "6px", fontWeight: "500" }}>
                                            Pesquisar Contratante Vinculado:
                                        </label>
                                        
                                        <input
                                            type="text"
                                            list="contratantes-list"
                                            placeholder="Digite o nome para buscar..."
                                            // Usamos key para resetar/atualizar o campo de texto quando o usuário mudar
                                            key={editandoId || "novo"} 
                                            defaultValue={formData.contratanteTextoBusca || ""}
                                            onChange={(e) => {
                                                const valorDigitado = e.target.value;
                                                
                                                // Procura um contratante cujo nome bata de forma idêntica
                                                const encontrado = contratantes.find(
                                                    (c) => c.nome.toLowerCase() === valorDigitado.toLowerCase()
                                                );
                                                
                                                if (encontrado) {
                                                    setFormData({ 
                                                        ...formData, 
                                                        contratanteId: encontrado.id,
                                                        contratanteTextoBusca: encontrado.nome 
                                                    });
                                                } else {
                                                    setFormData({ 
                                                        ...formData, 
                                                        contratanteId: "", 
                                                        contratanteTextoBusca: valorDigitado 
                                                    });
                                                }
                                            }}
                                            style={{ 
                                                width: "100%", 
                                                padding: "8px 12px", 
                                                border: "1px solid #cbd5e1", 
                                                borderRadius: "4px",
                                                boxSizing: "border-box"
                                            }}
                                        />

                                        <datalist id="contratantes-list">
                                            {contratantes.map((c) => (
                                                <option key={c.id} value={c.nome} />
                                            ))}
                                        </datalist>
                                    </div>
                                )}

                                    {/* Botões de Ação do Formulário */}
                                    <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                                        <Button 
                                            type="button"
                                            onClick={() => setModoCadastro(false)}>
                                            Cancelar
                                        </Button>
                                        <Button 
                                            type="submit">
                                            Salvar Usuário
                                        </Button>
                                    </div>

                                </form>
                            </Card>
                        )}
                    </div>
                )}
                {abaAtiva === "permissoes" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {!funcionarioSelecionado ? (
                            /* PASSO 1: LISTAR OS FUNCIONÁRIOS */
                            <Card title="Permissões de Usuários">
                                <p style={{ marginBottom: "15px" }}>Selecione um funcionário para gerenciar a quais contratantes ele tem acesso.</p>
                                    <Table 
                                        columns={colunasPermissoes} 
                                        // Filtra para exibir apenas os Funcionários ativos (perfil 2)
                                        data={usuarios.filter(u => u.perfil === 2 && Number(u.status) === 1)} 
                                    />
                            </Card>
                        ) : (
                            /* PASSO 2: GERENCIAR VÍNCULOS DO FUNCIONÁRIO SELECIONADO */
                            <Card title={`Permissões de: ${funcionarioSelecionado.nome}`}>
                                <Button 
                                    onClick={() => setFuncionarioSelecionado(null)}>
                                    ← Voltar para a lista
                                </Button>

                                {/* Formulário para Vincular Novo Contratante */}
                                
                                <h4 style={{ margin: "10px 0 0px 0" }}>Vincular a um Novo Contratante</h4>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <input
                                        type="text"
                                        list="contratantes-permissoes-list"
                                        placeholder="Pesquisar contratante para adicionar..."
                                        onChange={(e) => {
                                            const valor = e.target.value;
                                            const encontrado = contratantes.find(c => c.nome.toLowerCase() === valor.toLowerCase());
                                            if (encontrado) {
                                                handleAdicionarVinculo(encontrado.id);
                                                e.target.value = ""; // Limpa o input após adicionar
                                            }
                                        }}
                                        style={{ flex: 1, padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#35448a", color: "#fff" }}
                                    />
                                    <datalist id="contratantes-permissoes-list">
                                        {/* Filtra contratantes que já estão vinculados para não mostrá-los na busca */}
                                        {contratantes
                                            .filter(c => !vinculosAtuais.some(v => v.id === c.id))
                                            .map(c => <option key={c.id} value={c.nome} />)
                                        }
                                    </datalist>
                                </div>

                                {/* Tabela Simplificada com os Vínculos Atuais do Funcionário */}
                                <h4 style={{ margin: "10px 0 0 0" }}>Contratantes Vinculados atualmente:</h4>
                                {vinculosAtuais.length === 0 ? (
                                    <p style={{ color: "#64748b", fontStyle: "italic" }}>Este funcionário não possui acesso a nenhum contratante ainda.</p>
                                ) : (
                                    <Table
                                        columns={[
                                            { label: "Contratante", key: "nome", width: "80%" },
                                            { 
                                                label: "Ações", 
                                                key: "id", 
                                                width: "20%", 
                                                style: { textAlign: "right" },
                                                Cell: ({ row }) => (
                                                    <Button 
                                                        onClick={() => handleRemoverVinculo(row.id)}
                                                        style={{ padding: "6px 12px", backgroundColor: "#ef444422", color: "#f87171", border: "1px solid #ef444444", borderRadius: "4px", cursor: "pointer" }}
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
                )}
                {abaAtiva === "contratantes" && (
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
                            <Table
                                columns={colunasContratantes} 
                                data={contratantes.filter((c) => mostrarContratantesInativos ? true : Number(c.status) === 1)} 
                                getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                            />
                        </Card>
                    ) : (
                        /* TELA 2: FORMULÁRIO DE CADASTRO/EDIÇÃO DE CONTRATANTE */
                        <Card title={editandoContratanteId ? "Editar Contratante" : "Cadastrar Novo Contratante"}>
                            <form onSubmit={handleSalvarContratante} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <label style={{ fontWeight: "500" }}>Nome do Contratante:</label>
                                    <input 
                                        type="text" 
                                        required
                                        value={formContratante.nome}
                                        onChange={(e) => setFormContratante({ ...formContratante, nome: e.target.value })}
                                        placeholder="Ex: NE"
                                        style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#35448a", color: "#fff" }}
                                    />
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <label style={{ fontWeight: "500" }}>Razão Social:</label>
                                    <input 
                                        type="text"
                                        value={formContratante.razaoSocial || ""}
                                        onChange={(e) => setFormContratante({ ...formContratante, razaoSocial: e.target.value })}
                                        placeholder="Ex: NomeEmpresa"
                                        style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#35448a", color: "#fff" }}
                                    />
                                </div>

                                <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                                    <Button 
                                        type="button"
                                        onClick={() => setModoCadastroContratante(false)}>
                                        Cancelar
                                    </Button>
                                    <Button 
                                        type="submit">
                                        Salvar Contratante
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>
            )}  
                {abaAtiva === "lotes" && (
                    <Card title="Lotes importados">
                        <p>Visualize o histórico de Lotes importados no sistema.</p>
                        {carregandoLotes ? (
                            <div style={{ textAlign: "center", padding: "20px" }}>Carregando histórico de importações...</div>
                        ) : (
                            <Table
                                columns={colunasLotes} 
                                data={lotes} 
                            />
                        )}
                    </Card>
                )}

                {abaAtiva === "logs" && (
                    <Card title="Log de Atividades dos Usuários">
                        <p>Visualize os Logs registrados para cada Usuario e seus acessos do sistema.</p>
                        {carregandoLogs ? (
                            <div style={{ textAlign: "center", padding: "20px" }}>Carregando histórico de ações...</div>
                        ) : (
                            <Table
                                columns={colunasLogs} 
                                data={logs} 
                            />
                        )}
                    </Card>
                )}
            </main>
        </div>
    );
}