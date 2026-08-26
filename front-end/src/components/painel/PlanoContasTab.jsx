import { useState, useEffect, useMemo } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import Button from "../button/Button";
import Inputlist from "../Inputlist/Inputlist";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

const estiloCarregando = { textAlign: "center", padding: "20px", color: "#94a3b8" };

export default function PlanoContasTab({ token, banco }) {
    // ==========================================================
    // ESTADOS - REGRAS DE MAPEAMENTO
    // ==========================================================
    const [modoCadastroRegra, setModoCadastroRegra] = useState(false);
    const [regraEmEdicaoId, setRegraEmEdicaoId] = useState(null);
    const [regras, setRegras] = useState([]);
    const [carregandoRegras, setCarregandoRegras] = useState(false);

    // Formulário de Regra
    const [formRegra, setFormRegra] = useState({
        termoDescricao: "",
        termoTipo: "",
        termoFornecedor: "",
        planoContaTexto: "",
        contratanteTexto: "",
        unidadeTexto: "",
        bancoTexto: ""
    });

    // Filtros de Regras
    const [filtrosRegra, setFiltrosRegra] = useState({
        contratante: '', unidade: '', banco: '', descricao: '', tipo: '', fornecedor: '', plano: ''
    });

    // ==========================================================
    // ESTADOS - PLANO DE CONTAS
    // ==========================================================
    const [modoCadastroPlano, setModoCadastroPlano] = useState(false);
    const [planoEmEdicaoId, setPlanoEmEdicaoId] = useState(null);
    const [mostrarInativosPlano, setMostrarInativosPlano] = useState(false);
    const [planoContas, setPlanoContas] = useState([]);
    const [carregandoPlano, setCarregandoPlano] = useState(false);

    // Formulário do Plano de Contas
    const [formPlano, setFormPlano] = useState({
        planoConta: "",
        grupoConta: "",
        edre: "",
        dfc: "",
        efolha: ""
    });

    // Filtros do Plano de Contas
    const [filtrosPlano, setFiltrosPlano] = useState({
        plano: '', grupo: '', edre: '', dfc: '', efolha: ''
    });

    // Estado global de salvamento
    const [salvando, setSalvando] = useState(false);

    // Listas auxiliares (datalists)
    const [contratantes, setContratantes] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [bancos, setBancos] = useState([]);

    // ==========================================================
    // CARREGAMENTO DE DADOS (API)
    // ==========================================================
    const carregarPlanoContas = async () => {
        if (!token || !banco) return;
        setCarregandoPlano(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/planocontas?apenas_ativos=${!mostrarInativosPlano}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar plano de contas");
            const dados = await res.json();
            setPlanoContas(Array.isArray(dados) ? dados : dados.dados || []);
        } catch (err) {
            console.error("Erro ao carregar plano de contas:", err);
        } finally {
            setCarregandoPlano(false);
        }
    };

    const carregarRegras = async () => {
        if (!token || !banco) return;
        setCarregandoRegras(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/regras-planocontas`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar regras");
            const dados = await res.json();
            setRegras(Array.isArray(dados) ? dados : dados.dados || dados.regras || []);
        } catch (err) {
            console.error("Erro ao carregar regras:", err);
        } finally {
            setCarregandoRegras(false);
        }
    };

    const carregarListasAuxiliares = async () => {
        if (!token) return;
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [resCont, resUni, resBanc] = await Promise.all([
                fetch(`${API_BASE}/api/contratantes`, { headers }),
                fetch(`${API_BASE}/api/unidades`, { headers }),
                fetch(`${API_BASE}/api/bancos`, { headers })
            ]);

            if (resCont.ok) {
                const d = await resCont.json();
                setContratantes(Array.isArray(d) ? d : d.dados || []);
            }
            if (resUni.ok) {
                const d = await resUni.json();
                setUnidades(Array.isArray(d) ? d : d.dados || []);
            }
            if (resBanc.ok) {
                const d = await resBanc.json();
                setBancos(Array.isArray(d) ? d : d.dados || []);
            }
        } catch (err) {
            console.error("Erro ao carregar listas auxiliares:", err);
        }
    };

    useEffect(() => {
        carregarPlanoContas();
        carregarRegras();
        carregarListasAuxiliares();
    }, [token, banco, mostrarInativosPlano]);

    // ==========================================================
    // LÓGICA DE FILTRAGEM - REGRAS
    // ==========================================================
    const handleFilterRegraChange = (key, value) => setFiltrosRegra(prev => ({ ...prev, [key]: value }));
    const limparFiltrosRegra = () => setFiltrosRegra({ contratante: '', unidade: '', banco: '', descricao: '', tipo: '', fornecedor: '', plano: '' });

    const filtrarRegraExcecao = (chaveIgnorada) => {
        return regras.filter((item) => {
            const contratante = (item.contratanteNome || '- Geral -').toLowerCase();
            const unidade = (item.unidadeNome || '- Todas -').toLowerCase();
            const bancoNome = (item.bancoNome || '- Todos -').toLowerCase();
            const descricao = (item.termoDescricao || '- Qualquer -').toLowerCase();
            const tipo = (item.termoTipo || '- Qualquer -').toLowerCase();
            const fornecedor = (item.termoFornecedor || '- Qualquer -').toLowerCase();
            const plano = (item.destino || item.planoConta || '').toLowerCase();

            return (
                (chaveIgnorada === 'contratante' || contratante.includes(filtrosRegra.contratante.toLowerCase().trim())) &&
                (chaveIgnorada === 'unidade' || unidade.includes(filtrosRegra.unidade.toLowerCase().trim())) &&
                (chaveIgnorada === 'banco' || bancoNome.includes(filtrosRegra.banco.toLowerCase().trim())) &&
                (chaveIgnorada === 'descricao' || descricao.includes(filtrosRegra.descricao.toLowerCase().trim())) &&
                (chaveIgnorada === 'tipo' || tipo.includes(filtrosRegra.tipo.toLowerCase().trim())) &&
                (chaveIgnorada === 'fornecedor' || fornecedor.includes(filtrosRegra.fornecedor.toLowerCase().trim())) &&
                (chaveIgnorada === 'plano' || plano.includes(filtrosRegra.plano.toLowerCase().trim()))
            );
        });
    };

    const schemaFiltroRegra = [
        { key: "contratante", label: "Contratante", tipo: "inputlist", placeholder: "Buscar contratante...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('contratante').map(r => r.contratanteNome || '- Geral -').filter(Boolean))), [regras, filtrosRegra]) },
        { key: "unidade", label: "Unidade", tipo: "inputlist", placeholder: "Buscar unidade...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('unidade').map(r => r.unidadeNome || '- Todas -').filter(Boolean))), [regras, filtrosRegra]) },
        { key: "banco", label: "Banco", tipo: "inputlist", placeholder: "Buscar banco...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('banco').map(r => r.bancoNome || '- Todos -').filter(Boolean))), [regras, filtrosRegra]) },
        { key: "descricao", label: "Descrição", tipo: "inputlist", placeholder: "Buscar descrição...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('descricao').map(r => r.termoDescricao || '- Qualquer -').filter(Boolean))), [regras, filtrosRegra]) },
        { key: "tipo", label: "Tipo", tipo: "inputlist", placeholder: "Buscar tipo...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('tipo').map(r => r.termoTipo || '- Qualquer -').filter(Boolean))), [regras, filtrosRegra]) },
        { key: "fornecedor", label: "Fornecedor", tipo: "inputlist", placeholder: "Buscar fornecedor...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('fornecedor').map(r => r.termoFornecedor || '- Qualquer -').filter(Boolean))), [regras, filtrosRegra]) },
        { key: "plano", label: "Plano de Conta", tipo: "inputlist", placeholder: "Buscar plano...", options: useMemo(() => Array.from(new Set(filtrarRegraExcecao('plano').map(r => r.destino || r.planoConta).filter(Boolean))), [regras, filtrosRegra]) }
    ];

    const regrasFiltradas = useMemo(() => {
        return regras.filter((item) => {
            const contratante = (item.contratanteNome || '- Geral -').toLowerCase();
            const unidade = (item.unidadeNome || '- Todas -').toLowerCase();
            const bancoNome = (item.bancoNome || '- Todos -').toLowerCase();
            const descricao = (item.termoDescricao || '- Qualquer -').toLowerCase();
            const tipo = (item.termoTipo || '- Qualquer -').toLowerCase();
            const fornecedor = (item.termoFornecedor || '- Qualquer -').toLowerCase();
            const plano = (item.destino || item.planoConta || '').toLowerCase();

            return (
                contratante.includes(filtrosRegra.contratante.toLowerCase().trim()) &&
                unidade.includes(filtrosRegra.unidade.toLowerCase().trim()) &&
                bancoNome.includes(filtrosRegra.banco.toLowerCase().trim()) &&
                descricao.includes(filtrosRegra.descricao.toLowerCase().trim()) &&
                tipo.includes(filtrosRegra.tipo.toLowerCase().trim()) &&
                fornecedor.includes(filtrosRegra.fornecedor.toLowerCase().trim()) &&
                plano.includes(filtrosRegra.plano.toLowerCase().trim())
            );
        });
    }, [regras, filtrosRegra]);

    // ==========================================================
    // LÓGICA DE FILTRAGEM - PLANO DE CONTAS
    // ==========================================================
    const handleFilterPlanoChange = (key, value) => setFiltrosPlano(prev => ({ ...prev, [key]: value }));
    const limparFiltrosPlano = () => setFiltrosPlano({ plano: '', grupo: '', edre: '', dfc: '', efolha: '' });

    const filtrarPlanoExcecao = (chaveIgnorada) => {
        return planoContas.filter((item) => {
            const passaStatus = mostrarInativosPlano ? true : Number(item.status) === 1;
            const plano = (item.planoConta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || '').toLowerCase();

            return (
                passaStatus &&
                (chaveIgnorada === 'plano' || plano.includes(filtrosPlano.plano.toLowerCase().trim())) &&
                (chaveIgnorada === 'grupo' || grupo.includes(filtrosPlano.grupo.toLowerCase().trim())) &&
                (chaveIgnorada === 'edre' || edre.includes(filtrosPlano.edre.toLowerCase().trim())) &&
                (chaveIgnorada === 'dfc' || dfc.includes(filtrosPlano.dfc.toLowerCase().trim())) &&
                (chaveIgnorada === 'efolha' || efolha.includes(filtrosPlano.efolha.toLowerCase().trim()))
            );
        });
    };

    const schemaFiltroPlano = [
        { key: "plano", label: "Plano de Conta", tipo: "inputlist", placeholder: "Buscar plano...", options: useMemo(() => Array.from(new Set(filtrarPlanoExcecao('plano').map(p => p.planoConta).filter(Boolean))), [planoContas, filtrosPlano, mostrarInativosPlano]) },
        { key: "grupo", label: "Grupo de Conta", tipo: "inputlist", placeholder: "Buscar grupo...", options: useMemo(() => Array.from(new Set(filtrarPlanoExcecao('grupo').map(p => p.grupoConta).filter(Boolean))), [planoContas, filtrosPlano, mostrarInativosPlano]) },
        { key: "edre", label: "E-DRE", tipo: "inputlist", placeholder: "Buscar E-DRE...", options: useMemo(() => Array.from(new Set(filtrarPlanoExcecao('edre').map(p => p.edre).filter(Boolean))), [planoContas, filtrosPlano, mostrarInativosPlano]) },
        { key: "dfc", label: "DFC", tipo: "inputlist", placeholder: "Buscar DFC...", options: useMemo(() => Array.from(new Set(filtrarPlanoExcecao('dfc').map(p => p.dfc).filter(Boolean))), [planoContas, filtrosPlano, mostrarInativosPlano]) },
        { key: "efolha", label: "E-Folha", tipo: "inputlist", placeholder: "Buscar E-Folha...", options: useMemo(() => Array.from(new Set(filtrarPlanoExcecao('efolha').map(p => p.efolha).filter(Boolean))), [planoContas, filtrosPlano, mostrarInativosPlano]) }
    ];

    const planoContasFiltrados = useMemo(() => {
        return planoContas.filter((item) => {
            const passaStatus = mostrarInativosPlano ? true : Number(item.status) === 1;
            const plano = (item.planoConta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || '').toLowerCase();

            return (
                passaStatus &&
                plano.includes(filtrosPlano.plano.toLowerCase().trim()) &&
                grupo.includes(filtrosPlano.grupo.toLowerCase().trim()) &&
                edre.includes(filtrosPlano.edre.toLowerCase().trim()) &&
                dfc.includes(filtrosPlano.dfc.toLowerCase().trim()) &&
                efolha.includes(filtrosPlano.efolha.toLowerCase().trim())
            );
        });
    }, [planoContas, filtrosPlano, mostrarInativosPlano]);

    // ==========================================================
    // AÇÕES - REGRAS
    // ==========================================================
    const handleSalvarRegra = async (e) => {
        e.preventDefault();

        if (!formRegra.termoDescricao.trim() && !formRegra.termoTipo.trim() && !formRegra.termoFornecedor.trim()) {
            alert("Preencha ao menos um dos termos: Descrição, Tipo ou Fornecedor!");
            return;
        }

        if (!formRegra.planoContaTexto.trim()) {
            alert("Por favor, selecione um Plano de Contas válido!");
            return;
        }

        const contaEncontrada = planoContas.find(p =>
            String(p.planoConta || "").trim().toLowerCase() === formRegra.planoContaTexto.trim().toLowerCase()
        );

        if (!contaEncontrada) {
            alert("Plano de Contas não encontrado! Selecione uma opção válida da lista.");
            return;
        }

        let idContratante = null;
        if (formRegra.contratanteTexto.trim()) {
            const cEncontrado = contratantes.find(c => String(c.nome || c.razaoSocial || "").trim().toLowerCase() === formRegra.contratanteTexto.trim().toLowerCase());
            if (!cEncontrado) return alert("O contratante digitado não existe!");
            idContratante = cEncontrado.id;
        }

        let idUnidade = null;
        if (formRegra.unidadeTexto.trim()) {
            const uEncontrada = unidades.find(u => String(u.nome || u.descricao || "").trim().toLowerCase() === formRegra.unidadeTexto.trim().toLowerCase());
            if (!uEncontrada) return alert("A unidade digitada não existe!");
            idUnidade = uEncontrada.id;
        }

        let idBanco = null;
        if (formRegra.bancoTexto.trim()) {
            const bEncontrado = bancos.find(b => String(b.nome || b.codigo || "").trim().toLowerCase() === formRegra.bancoTexto.trim().toLowerCase());
            if (!bEncontrado) return alert("O banco digitado não existe!");
            idBanco = bEncontrado.id;
        }

        const isEdicao = Boolean(regraEmEdicaoId);
        const url = isEdicao
            ? `${API_BASE}/api/${banco}/regras-planocontas/${regraEmEdicaoId}`
            : `${API_BASE}/api/${banco}/regras-planocontas`;

        const payload = {
            termoDescricao: formRegra.termoDescricao.trim() || null,
            termoTipo: formRegra.termoTipo.trim() || null,
            termoFornecedor: formRegra.termoFornecedor.trim() || null,
            planoContaId: Number(contaEncontrada.id),
            contratanteId: idContratante ? Number(idContratante) : null,
            unidadeId: idUnidade ? Number(idUnidade) : null,
            bancoId: idBanco ? Number(idBanco) : null
        };

        setSalvando(true);
        try {
            const res = await fetch(url, {
                method: isEdicao ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            const dados = await res.json();
            if (!res.ok) throw new Error(dados.detail || "Erro ao salvar regra.");

            alert(isEdicao ? "Regra atualizada com sucesso!" : "Regra cadastrada com sucesso!");
            setModoCadastroRegra(false);
            carregarRegras();
        } catch (err) {
            alert(`Falha ao salvar: ${err.message}`);
        } finally {
            setSalvando(false);
        }
    };

    const handleIniciarEdicaoRegra = (row) => {
        setRegraEmEdicaoId(row.id);
        setFormRegra({
            termoDescricao: row.termoDescricao || "",
            termoTipo: row.termoTipo || "",
            termoFornecedor: row.termoFornecedor || "",
            planoContaTexto: row.destino || row.planoConta || "",
            contratanteTexto: row.contratanteNome || "",
            unidadeTexto: row.unidadeNome || "",
            bancoTexto: row.bancoNome || ""
        });
        setModoCadastroRegra(true);
    };

    const handleExcluirRegra = async (idRegra) => {
        if (!window.confirm("Tem certeza que deseja excluir esta regra?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/regras-planocontas/${idRegra}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao excluir regra.");
            alert("Regra excluída com sucesso!");
            carregarRegras();
        } catch (err) {
            alert(`Falha ao excluir: ${err.message}`);
        }
    };

    // ==========================================================
    // AÇÕES - PLANO DE CONTAS
    // ==========================================================
    const handleSalvarPlano = async (e) => {
        e.preventDefault();

        if (!formPlano.planoConta.trim() || !formPlano.grupoConta.trim() || !formPlano.edre.trim() || !formPlano.dfc.trim() || !formPlano.efolha.trim()) {
            alert("Todos os campos do Plano de Contas são obrigatórios!");
            return;
        }

        setSalvando(true);
        const isEdicao = Boolean(planoEmEdicaoId);
        const url = isEdicao 
            ? `${API_BASE}/api/${banco}/planocontas/${planoEmEdicaoId}` 
            : `${API_BASE}/api/${banco}/planocontas`;

        try {
            const res = await fetch(url, {
                method: isEdicao ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    planoConta: formPlano.planoConta.trim(),
                    grupoConta: formPlano.grupoConta.trim(),
                    edre: formPlano.edre.trim(),
                    dfc: formPlano.dfc.trim(),
                    efolha: formPlano.efolha.trim()
                })
            });

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar plano de contas.");

            alert(isEdicao ? "Plano de contas atualizado!" : "Plano de contas criado com sucesso!");
            setModoCadastroPlano(false);
            carregarPlanoContas();
        } catch (err) {
            alert(err.message);
        } finally {
            setSalvando(false);
        }
    };

    const handleIniciarEdicaoPlano = (row) => {
        setPlanoEmEdicaoId(row.id);
        setFormPlano({
            planoConta: row.planoConta || "",
            grupoConta: row.grupoConta || "",
            edre: row.edre || "",
            dfc: row.dfc || "",
            efolha: row.efolha || ""
        });
        setModoCadastroPlano(true);
    };

    const handleAlternarStatusPlano = async (row) => {
        const isAtivo = Number(row.status) === 1;
        const confirmacao = window.confirm(`Deseja realmente ${isAtivo ? "inativar" : "reativar"} este plano de contas?`);
        if (!confirmacao) return;

        try {
            const res = await fetch(`${API_BASE}/api/${banco}/planocontas/${row.id}`, {
                method: "DELETE", // Soft Delete (status = 2)
                headers: { Authorization: `Bearer ${token}` }
            });
            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao alterar status.");

            alert("Plano de contas inativado com sucesso!");
            carregarPlanoContas();
        } catch (err) {
            alert(err.message);
        }
    };

    // ==========================================================
    // DEFINIÇÃO DAS COLUNAS
    // ==========================================================
    const colunasRegras = [
        { label: "Contratante", key: "contratanteNome", width: "15%", Cell: ({ row }) => row.contratanteNome || <span>- Geral -</span> },
        { label: "Unidade", key: "unidadeNome", width: "12%", Cell: ({ row }) => row.unidadeNome || <span>- Todas -</span> },
        { label: "Banco", key: "bancoNome", width: "12%", Cell: ({ row }) => row.bancoNome || <span>- Todos -</span> },
        { label: "Descrição", key: "termoDescricao", width: "18%", Cell: ({ row }) => row.termoDescricao || <span>- Qualquer -</span> },
        { label: "Tipo", key: "termoTipo", width: "18%", Cell: ({ row }) => row.termoTipo || <span>- Qualquer -</span> },
        { label: "Fornecedor", key: "termoFornecedor", width: "18%", Cell: ({ row }) => row.termoFornecedor || <span>- Qualquer -</span> },
        { label: "Plano de Contas", key: "destino", width: "15%", Cell: ({ row }) => <span>{row.destino || row.planoConta || `ID: ${row.planoContaId}`}</span> },
        {
            label: "Ações", key: "acoes", width: "120px", style: { textAlign: "center", position: "sticky", right: 0, zIndex: 2 },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <Button onClick={() => handleIniciarEdicaoRegra(row)}>Editar</Button>
                    <Button onClick={() => handleExcluirRegra(row.id)} style={{ backgroundColor: "#ef4444" }}>Excluir</Button>
                </div>
            )
        }
    ];

    const colunasPlanoContas = [
        { label: "Plano de Contas", key: "planoConta", width: "25%", Cell: ({ row }) => <span style={{ fontWeight: "600" }}>{row.planoConta}</span> },
        { label: "Grupo de Contas", key: "grupoConta", width: "20%" },
        { label: "e-DRE", key: "edre", width: "15%" },
        { label: "DFC", key: "dfc", width: "15%" },
        {
            label: "e-Folha", key: "efolha", width: "15%",
            Cell: ({ row }) => (
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span>{row.efolha}</span>
                    {Number(row.status) === 2 && (
                        <span style={{ fontSize: "11px", backgroundColor: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px", fontWeight: "600" }}>
                            Inativo
                        </span>
                    )}
                </div>
            )
        },
        {
            label: "Ações", key: "acoes", width: "10%", style: { textAlign: "center" },
            Cell: ({ row }) => {
                const isAtivo = Number(row.status) === 1;
                return (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Button onClick={() => handleIniciarEdicaoPlano(row)}>Editar</Button>
                        {isAtivo && (
                            <Button onClick={() => handleAlternarStatusPlano(row)} style={{ backgroundColor: "#ef444422", color: "#f87171" }}>
                                Inativar
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];

    // ==========================================================
    // RENDER PRINCIPAL
    // ==========================================================
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* 1. SEÇÃO DE REGRAS DE MAPEAMENTO */}
            {!modoCadastroRegra ? (
                <Card title="Regras de Mapeamento do Plano de Contas">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <p>Gerencie as regras automáticas de depara para conciliação bancária.</p>
                        <Button 
                            onClick={() => { setRegraEmEdicaoId(null); 
                            setFormRegra({ 
                                termoDescricao: "", 
                                termoTipo: "", 
                                termoFornecedor: "", 
                                planoContaTexto: "", 
                                contratanteTexto: "", 
                                unidadeTexto: "", 
                                bancoTexto: "" }); 
                            setModoCadastroRegra(true); }}>
                            + Nova Regra
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <FiltroBar 
                            schema={schemaFiltroRegra} 
                            filtros={filtrosRegra} 
                            onChange={handleFilterRegraChange} 
                            onLimpar={limparFiltrosRegra} />
                    </div>

                    {carregandoRegras ? <div style={estiloCarregando}>Carregando regras...</div> : <Table columns={colunasRegras} data={regrasFiltradas} />}
                </Card>
            ) : (
                <Card title={regraEmEdicaoId ? "Editar Regra de Mapeamento" : "Nova Regra de Mapeamento"}>
                    <form onSubmit={handleSalvarRegra} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        <div>
                            <Inputlist 
                                id="regra-contratante" 
                                label="Contratante (Opcional - Vazio para Regra Geral)" 
                                placeholder="Escolha o contratante..." 
                                value={formRegra.contratanteTexto} 
                                onChange={(e) => setFormRegra({ ...formRegra, contratanteTexto: e.target.value })} 
                                options={contratantes} valueKey={(c) => c.nome || c.razaoSocial || ""} />
                        </div>
                        <div>
                            <Inputlist 
                                id="regra-unidade" 
                                label="Unidade (Opcional - Vazio para Todas)" 
                                placeholder="Escolha a unidade..." 
                                value={formRegra.unidadeTexto} 
                                onChange={(e) => setFormRegra({ ...formRegra, unidadeTexto: e.target.value })} 
                                options={unidades} valueKey={(u) => u.nome || u.descricao || ""} />
                        </div>
                        <div>
                            <Inputlist 
                                id="regra-banco" 
                                label="Banco (Opcional - Vazio para Todos)" 
                                placeholder="Escolha o banco..." 
                                value={formRegra.bancoTexto} 
                                onChange={(e) => setFormRegra({ ...formRegra, bancoTexto: e.target.value })} 
                                options={bancos} valueKey={(b) => b.nome || b.codigo || ""} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Termo na Descrição</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Ex: TARIFA, ALUGUEL..." 
                                value={formRegra.termoDescricao} 
                                onChange={(e) => setFormRegra({ ...formRegra, termoDescricao: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Termo no Tipo</label>
                            <input 
                                type="text" className="form-input" 
                                placeholder="Ex: PIX, TED..." 
                                value={formRegra.termoTipo} 
                                onChange={(e) => setFormRegra({ ...formRegra, termoTipo: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Termo no Fornecedor</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="Ex: BANCO DO BRASIL" 
                                value={formRegra.termoFornecedor} 
                                onChange={(e) => setFormRegra({ ...formRegra, termoFornecedor: e.target.value })} />
                        </div>
                        <div>
                            <Inputlist 
                                id="regra-plano-destino" 
                                label="Plano de Contas (Destino) *" 
                                placeholder="Digite ou escolha o plano de contas..." 
                                value={formRegra.planoContaTexto} 
                                onChange={(e) => setFormRegra({ ...formRegra, planoContaTexto: e.target.value })} 
                                options={planoContas} 
                                valueKey={(p) => p.planoConta || ""} required />
                        </div>

                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                            <Button 
                                type="button" 
                                onClick={() => setModoCadastroRegra(false)} 
                                disabled={salvando}>
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={salvando}>{salvando ? "Salvando..." : "Salvar Regra"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* 2. SEÇÃO DO CADASTRO DO PLANO DE CONTAS */}
            {!modoCadastroPlano ? (
                <Card title="Gerenciamento do Plano de Contas">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie a estrutura do Plano de Contas.</p>
                            <Button onClick={() => setMostrarInativosPlano(!mostrarInativosPlano)} style={{ backgroundColor: mostrarInativosPlano ? "#ef4444" : "#35448a" }}>
                                {mostrarInativosPlano ? "Ver Apenas Ativos" : "Mostrar Inativos"}
                            </Button>
                        </div>
                        <Button onClick={() => { setPlanoEmEdicaoId(null); setFormPlano({ planoConta: "", grupoConta: "", edre: "", dfc: "", efolha: "" }); setModoCadastroPlano(true); }}>
                            + Novo Plano de Contas
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <FiltroBar 
                            schema={schemaFiltroPlano} 
                            filtros={filtrosPlano} 
                            onChange={handleFilterPlanoChange} 
                            onLimpar={limparFiltrosPlano} />
                    </div>

                    {carregandoPlano ? <div style={estiloCarregando}>Carregando plano...</div> : <Table columns={colunasPlanoContas} data={planoContasFiltrados} getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""} />}
                </Card>
            ) : (
                <Card title={planoEmEdicaoId ? "Editar Plano de Contas" : "Cadastrar Novo Plano de Contas"}>
                    <form onSubmit={handleSalvarPlano} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        <div className="form-group">
                            <label className="form-label">Plano de Contas *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                required value={formPlano.planoConta} 
                                onChange={(e) => setFormPlano({ ...formPlano, planoConta: e.target.value })} 
                                placeholder="Ex: Despesas Operacionais" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Grupo de Contas *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                required value={formPlano.grupoConta} 
                                onChange={(e) => setFormPlano({ ...formPlano, grupoConta: e.target.value })} 
                                placeholder="Ex: Despesas Administrativas" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">e-DRE *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                required value={formPlano.edre} 
                                onChange={(e) => setFormPlano({ ...formPlano, edre: e.target.value })} 
                                placeholder="Ex: Serviços de Terceiros" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">DFC *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                required value={formPlano.dfc} 
                                onChange={(e) => setFormPlano({ ...formPlano, dfc: e.target.value })} 
                                placeholder="Ex: Outros Serviços" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">e-Folha *</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                required value={formPlano.efolha} 
                                onChange={(e) => setFormPlano({ ...formPlano, efolha: e.target.value })} 
                                placeholder="Ex: N/A" />
                        </div>

                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "10px" }}>
                            <Button 
                                type="button" 
                                onClick={() => setModoCadastroPlano(false)} 
                                disabled={salvando}>
                                Cancelar
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={salvando}>{salvando ? "Salvando..." : "Salvar Plano"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}