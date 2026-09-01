import { useState, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import Inputlist from "../Inputlist/Inputlist";
import { useFetch } from "../../utils/useFetch";
import { API_BASE } from "../../context/AuthContext";
import { ExportarExcel } from "../../utils/ExportarExcel";

const TIPOS_UNIDADE = {
    1: "Registro",
    2: "Atuação",
    3: "Ambos"
};

export default function UnidadesTab({ token }) {
    const [modoCadastroUnidade, setModoCadastroUnidade] = useState(false);
    const [editandoUnidadeId, setEditandoUnidadeId] = useState(null);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [carregando, setCarregando] = useState(false);

    // FORMULÁRIO DE UNIDADE
    const [formUnidade, setFormUnidade] = useState({ 
        nome: "", 
        razaoSocial: "", 
        cnpj: "", 
        contratanteId: "", 
        bancoId: "",
        agencia: "",
        conta: "",
        tipo: 1 
    });

    // BUSCA DE DADOS COM HOOK REUTILIZÁVEL
    const { data: contratantes = [], refetch: carregarContratantes } = useFetch('/api/contratantes', token);
    const { data: bancos = [], refetch: carregarBancos } = useFetch('/api/bancos', token);
    const { data: unidades = [], refetch: carregarUnidades } = useFetch('/api/unidades', token);

    const [contratanteTexto, setContratanteTexto] = useState("");
    const [bancoTexto, setBancoTexto] = useState("");

    // Recarrega todos os dados após alterações
    const recarregarTodosDados = () => {
        carregarContratantes();
        carregarBancos();
        carregarUnidades();
    };

    // FUNÇÕES AUXILIARES PARA RESOLVER NOMES DE BANCO E CONTRATANTE
    const obterNomeBanco = (unidade) => {
        if (unidade.banco) return unidade.banco;
        
        // Fallback buscando no array de bancos
        const bId = unidade.bancoId || unidade.banco_id;
        const banco = bancos.find(b => Number(b.id) === Number(bId));
        return banco ? banco.nome : "";
    };

    const obterNomeContratante = (unidade) => {
        if (unidade.contratante?.nome || unidade.contratante?.razaoSocial) {
            return unidade.contratante.nome || unidade.contratante.razaoSocial;
        }
        const cId = unidade.contratanteId || unidade.contratante_id;
        const contratante = contratantes.find(c => Number(c.id) === Number(cId));
        return contratante ? (contratante.nome || contratante.razaoSocial) : "";
    };

    // --- ESTADOS DO FILTROBAR ---
    const [filtros, setFiltros] = useState({
        nome: '',
        razaoSocial: '',
        cnpj: '',
        contratanteId: '',
        banco: '',
        agencia: '',
        conta: '',
        tipo: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: '',
            razaoSocial: '',
            cnpj: '',
            contratanteId: '',
            banco: '',
            agencia: '',
            conta: '',
            tipo: ''
        });
    };

    // OPÇÕES DOS AUTOCOMPLETES NO FILTRO (Apenas bancos presentes nas unidades cadastradas)
    const opcoesNome = useMemo(() => Array.from(new Set(unidades.map(u => u.nome).filter(Boolean))), [unidades]);
    const opcoesRazao = useMemo(() => Array.from(new Set(unidades.map(u => u.razaoSocial || u.razao_social).filter(Boolean))), [unidades]);
    const opcoesCnpj = useMemo(() => Array.from(new Set(unidades.map(u => u.cnpj).filter(Boolean))), [unidades]);
    const opcoesContratantes = useMemo(() => contratantes.map(c => c.nome || c.razaoSocial || c.razao_social).filter(Boolean), [contratantes]);
    
    // Pega apenas os nomes de bancos que realmente existem nas unidades cadastradas
    const opcoesBancosFiltro = useMemo(() => {
        const nomesBancosNasUnidades = unidades.map(u => obterNomeBanco(u)).filter(Boolean);
        return Array.from(new Set(nomesBancosNasUnidades));
    }, [unidades, bancos]);

    // Opções de Bancos para o SELECT/INPUTLIST do Formulário de Cadastro/Edição
    const opcoesBancosCadastro = useMemo(() => bancos.map(b => b.nome).filter(Boolean), [bancos]);

    const opcoesAgencia = useMemo(() => Array.from(new Set(unidades.map(u => u.agencia).filter(Boolean))), [unidades]);
    const opcoesConta = useMemo(() => Array.from(new Set(unidades.map(u => u.conta).filter(Boolean))), [unidades]);

    const handleContratanteChange = (valorTexto) => {
        const texto = typeof valorTexto === 'object' ? valorTexto.target?.value || '' : valorTexto;
        setContratanteTexto(texto);

        const encontrado = contratantes.find(
            c => (c.nome || c.razaoSocial || c.razao_social || "").toLowerCase() === texto.toLowerCase().trim()
        );

        setFormUnidade(prev => ({
            ...prev,
            contratanteId: encontrado ? encontrado.id : ""
        }));
    };

    const handleBancoChange = (valorTexto) => {
        const texto = typeof valorTexto === 'object' ? valorTexto.target?.value || '' : valorTexto;
        setBancoTexto(texto);

        const encontrado = bancos.find(b => {
            const rotulo = `${b.codigo ? b.codigo + ' - ' : ''}${b.nome}`.toLowerCase();
            return rotulo === texto.toLowerCase().trim() || b.nome.toLowerCase() === texto.toLowerCase().trim();
        });

        setFormUnidade(prev => ({
            ...prev,
            bancoId: encontrado ? encontrado.id : ""
        }));
    };

    const schemaFiltroUnidade = [
        { key: "nome", label: "Nome Fantasia", tipo: "inputlist", placeholder: "Buscar por Nome...", options: opcoesNome },
        { key: "razaoSocial", label: "Razão Social", tipo: "inputlist", placeholder: "Buscar por Razão...", options: opcoesRazao },
        { key: "contratanteId", label: "Contratante", tipo: "inputlist", placeholder: "Buscar por Contratante...", options: opcoesContratantes },
        { key: "cnpj", label: "CNPJ", tipo: "inputlist", placeholder: "Buscar por CNPJ...", options: opcoesCnpj },
        { key: "banco", label: "Banco", tipo: "inputlist", placeholder: "Buscar por Banco...", options: opcoesBancosFiltro },
        { key: "agencia", label: "Agência", tipo: "inputlist", placeholder: "Buscar por Agência...", options: opcoesAgencia },
        { key: "conta", label: "Conta", tipo: "inputlist", placeholder: "Buscar por Conta...", options: opcoesConta },
        {
            key: "tipo",
            label: "Tipo",
            tipo: "select",
            options: [
                { value: "", label: "Todos" },
                { value: "1", label: "Registro" },
                { value: "2", label: "Atuação" },
                { value: "3", label: "Ambos" }
            ]
        }
    ];

    const unidadesFiltradas = useMemo(() => {
        return unidades.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const razao = (item.razaoSocial || item.razao_social || '').toLowerCase();
            const cnpj = (item.cnpj || '').toLowerCase();
            const agencia = (item.agencia || '').toLowerCase();
            const conta = (item.conta || '').toLowerCase();
            const tipo = String(item.tipo || '');

            const nomeContratante = obterNomeContratante(item).toLowerCase();
            const nomeBanco = obterNomeBanco(item).toLowerCase();

            return (
                passaStatus &&
                nome.includes(filtros.nome.toLowerCase().trim()) &&
                razao.includes(filtros.razaoSocial.toLowerCase().trim()) &&
                cnpj.includes(filtros.cnpj.toLowerCase().trim()) &&
                (!filtros.contratanteId || nomeContratante.includes(filtros.contratanteId.toLowerCase().trim())) &&
                (!filtros.banco || nomeBanco.includes(filtros.banco.toLowerCase().trim())) &&
                (!filtros.agencia || agencia.includes(filtros.agencia.toLowerCase().trim())) &&
                (!filtros.conta || conta.includes(filtros.conta.toLowerCase().trim())) &&
                (!filtros.tipo || tipo === String(filtros.tipo))
            );
        });
    }, [unidades, filtros, mostrarInativos, contratantes, bancos]);

    // --- SALVAR (CRIAR / ATUALIZAR) ---
    const handleSalvarUnidade = async (e) => {
        e.preventDefault();

        if (!formUnidade.nome.trim()) {
            alert("O Nome da Unidade é obrigatório.");
            return;
        }

        if (!formUnidade.contratanteId) {
            alert("Selecione um Contratante válido da lista.");
            return;
        }

        setCarregando(true);

        const url = editandoUnidadeId 
            ? `${API_BASE}/api/unidades/${editandoUnidadeId}` 
            : `${API_BASE}/api/unidades`;
            
        const metodo = editandoUnidadeId ? "PUT" : "POST";

        const payload = {
            nome: formUnidade.nome.trim(),
            razaoSocial: formUnidade.razaoSocial?.trim() || null,
            cnpj: formUnidade.cnpj?.trim() || null,
            contratanteId: formUnidade.contratanteId ? Number(formUnidade.contratanteId) : null,
            bancoContaId: editandoUnidadeId && formUnidade.bancoContaId ? Number(formUnidade.bancoContaId) : null, // Envia o ID da conta na edição
            bancoId: formUnidade.bancoId ? Number(formUnidade.bancoId) : null,
            agencia: formUnidade.agencia?.trim() || null,
            conta: formUnidade.conta?.trim() || null,
            tipo: Number(formUnidade.tipo) || 1
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
                const erroMsg = typeof resposta.detail === 'string' 
                    ? resposta.detail 
                    : Array.isArray(resposta.detail) 
                        ? resposta.detail.map(e => e.msg).join(', ') 
                        : "Erro ao salvar unidade.";
                throw new Error(erroMsg);
            }

            alert("Unidade salva com sucesso!");
            setModoCadastroUnidade(false);
            
            // Atualiza os dados vindo diretamente do servidor
            await recarregarTodosDados();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const handleIniciarEdicaoUnidade = (unidade) => {
        const cId = unidade.contratanteId || unidade.contratante_id;
        const bId = unidade.bancoId || unidade.banco_id;

        const contratanteEncontrado = contratantes.find(c => Number(c.id) === Number(cId));
        const bancoEncontrado = bancos.find(b => Number(b.id) === Number(bId));
        
        setFormUnidade({
            nome: unidade.nome || "",
            razaoSocial: unidade.razaoSocial || unidade.razao_social || "",
            cnpj: unidade.cnpj || "",
            contratanteId: cId || "",
            bancoContaId: unidade.bancoContaId || unidade.banco_conta_id || "", // Adicionado para carregar o ID da conta
            bancoId: bId || "",
            agencia: unidade.agencia || "",
            conta: unidade.conta || "",
            tipo: unidade.tipo || 1
        });
        
        setContratanteTexto(
            contratanteEncontrado 
                ? (contratanteEncontrado.nome || contratanteEncontrado.razaoSocial || contratanteEncontrado.razao_social) 
                : obterNomeContratante(unidade)
        );
        
        setBancoTexto(
            bancoEncontrado 
                ? bancoEncontrado.nome 
                : obterNomeBanco(unidade)
        );

        setEditandoUnidadeId(unidade.id);
        setModoCadastroUnidade(true);
    };

    const handleAlternarStatusUnidade = async (unidade) => {
        const isAtivo = Number(unidade.status) === 1;
        const confirmacao = window.confirm(`Deseja realmente ${isAtivo ? "desativar" : "reativar"} a unidade "${unidade.nome}"?`);
        if (!confirmacao) return;

        try {
            const res = await fetch(`${API_BASE}/api/unidades/${unidade.id}/status?ativo=${!isAtivo}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao alterar status da unidade.");

            alert(resposta.mensagem || "Status atualizado com sucesso!");
            carregarUnidades();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasUnidades = [
        {
            label: "Contratante",
            key: "contratanteId",
            width: "150px",
            Cell: ({ row }) => obterNomeContratante(row) || "-"
        },
        {
            label: "Nome Fantasia",
            key: "nome",
            width: "200px",
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
            width: "200px",
            Cell: ({ row }) => row.razaoSocial || row.razao_social || "-"
        },
        {
            label: "CNPJ",
            key: "cnpj",
            width: "140px",
            Cell: ({ row }) => row.cnpj || "-"
        },
        {
            label: "Banco",
            key: "banco",
            width: "160px",
            Cell: ({ row }) => obterNomeBanco(row) || "-"
        },
        {
            label: "Agência",
            key: "agencia",
            width: "100px",
            Cell: ({ row }) => row.agencia || "-"
        },
        {
            label: "Conta",
            key: "conta",
            width: "120px",
            Cell: ({ row }) => row.conta || "-"
        },
        {
            label: "Tipo",
            key: "tipo",
            width: "100px",
            Cell: ({ row }) => TIPOS_UNIDADE[row.tipo] || "Não Informado"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "180px",
            style: { 
                position: "sticky", 
                right: 0, 
                backgroundColor: "#fff", 
                zIndex: 2, 
                boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
                textAlign: "center" 
            },
            Cell: ({ row }) => {
                const isAtivo = Number(row.status) === 1;
                return (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <Button onClick={() => handleIniciarEdicaoUnidade(row)}>
                            Editar
                        </Button>
                        <Button
                            onClick={() => handleAlternarStatusUnidade(row)}
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

    const handleExportarUnidade = () => {
        ExportarExcel({
            tabela: "unidade",
            colunas: ["CONTRATANTE", "NOME", "RAZAO SOCIAL", "BANCO", "AGENCIA", "CONTA", "CNPJ", "TIPO"],
            nomeArquivoCustomizado: "Mapa_Unidades.xlsx"
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastroUnidade ? (
                <Card title="Gerenciamento de Unidades">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie as unidades cadastradas no sistema.</p>
                            <Button
                                onClick={() => setMostrarInativos(!mostrarInativos)}
                                style={{
                                    backgroundColor: mostrarInativos ? "#ef4444" : "#35448a",
                                }}
                            >
                                {mostrarInativos ? "Ver Apenas Ativas" : "Mostrar Inativas"}
                            </Button>
                        </div>
                        <Button
                            onClick={() => {
                                setEditandoUnidadeId(null);
                                setFormUnidade({ 
                                    nome: "", 
                                    razaoSocial: "", 
                                    cnpj: "", 
                                    contratanteId: "", 
                                    bancoId: "", 
                                    agencia: "", 
                                    conta: "", 
                                    tipo: 1 
                                });
                                setContratanteTexto("");
                                setBancoTexto("");
                                setModoCadastroUnidade(true);
                            }}
                        >
                            + Cadastrar Nova Unidade
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltroUnidade}
                                filtros={filtros}
                                onChange={handleFilterChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", margin: "8px" }}>
                            <Button onClick={() => handleExportarUnidade()}>Baixar Tudo</Button>
                        </div>
                        <Table
                            columns={colunasUnidades}
                            data={unidadesFiltradas}
                            getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                        />
                    </div>
                </Card>
            ) : (
                <Card title={editandoUnidadeId ? "Editar Unidade" : "Cadastrar Nova Unidade"}>
                    <form onSubmit={handleSalvarUnidade} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        
                        <div className="form-group">
                            <label className="form-label">Contratante *</label>
                            <Inputlist
                                id="contratante"
                                placeholder="Pesquisar contratante para adicionar..."
                                options={opcoesContratantes}
                                value={contratanteTexto}
                                onChange={handleContratanteChange}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nome Fantasia *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formUnidade.nome}
                                onChange={(e) => setFormUnidade({ ...formUnidade, nome: e.target.value })}
                                placeholder="Ex: Unidade Matriz, Filial SP"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Razão Social</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formUnidade.razaoSocial}
                                onChange={(e) => setFormUnidade({ ...formUnidade, razaoSocial: e.target.value })}
                                placeholder="Ex: Empresa de Serviços LTDA"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">CNPJ</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formUnidade.cnpj}
                                onChange={(e) => setFormUnidade({ ...formUnidade, cnpj: e.target.value })}
                                placeholder="00.000.000/0000-00"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Banco</label>
                            <Inputlist
                                id="banco"
                                placeholder="Pesquisar banco..."
                                options={opcoesBancosCadastro}
                                value={bancoTexto}
                                onChange={handleBancoChange}
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                            <div className="form-group">
                                <label className="form-label">Agência</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formUnidade.agencia}
                                    onChange={(e) => setFormUnidade({ ...formUnidade, agencia: e.target.value })}
                                    placeholder="Ex: 0001"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Conta</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formUnidade.conta}
                                    onChange={(e) => setFormUnidade({ ...formUnidade, conta: e.target.value })}
                                    placeholder="Ex: 12345-6"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tipo de Unidade *</label>
                            <select
                                className="form-input"
                                required
                                value={formUnidade.tipo}
                                onChange={(e) => setFormUnidade({ ...formUnidade, tipo: e.target.value })}
                            >
                                <option value={1}>Registro</option>
                                <option value={2}>Atuação</option>
                                <option value={3}>Ambos</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastroUnidade(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Unidade"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}