import { useState, useEffect, useMemo } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import Button from "../button/Button";
import Inputlist from "../Inputlist/Inputlist";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

const estiloCarregando = { textAlign: "center", padding: "20px", color: "#94a3b8" };

export default function PlanoContasTab({ token, banco }) {
    // Filtros da tabela de Regras
    const [filtrosRegra, setFiltrosRegra] = useState({
        contratante: '',
        unidade: '',
        banco: '',
        descricao: '',
        tipo: '',
        fornecedor: '',
        plano: ''
    });

    // Filtros da tabela de Plano de Contas
    const [filtrosPlano, setFiltrosPlano] = useState({
        plano: '',
        grupo: '',
        edre: '',
        dfc: '',
        efolha: ''
    });

    // Dados principais
    const [planoContas, setPlanoContas] = useState([]);
    const [carregandoPlano, setCarregandoPlano] = useState(false);
    const [regras, setRegras] = useState([]);
    const [carregandoRegras, setCarregandoRegras] = useState(false);

    // Listas auxiliares (datalists)
    const [contratantes, setContratantes] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [bancos, setBancos] = useState([]);

    // Estados do formulário do Modal
    const [modalAberto, setModalAberto] = useState(false);
    const [termoDescricao, setTermoDescricao] = useState('');
    const [termoTipo, setTermoTipo] = useState('');
    const [termoFornecedor, setTermoFornecedor] = useState('');
    const [planoContaTexto, setPlanoContaTexto] = useState('');
    const [contratanteTexto, setContratanteTexto] = useState('');
    const [unidadeTexto, setUnidadeTexto] = useState('');
    const [bancoTexto, setBancoTexto] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [regraEmEdicao, setRegraEmEdicao] = useState(null);

    // ==========================================================
    // FILTROS - REGRAS
    // ==========================================================

    const handleFilterRegraChange = (key, value) => {
        setFiltrosRegra((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltrosRegra = () => {
        setFiltrosRegra({
            contratante: '',
            unidade: '',
            banco: '',
            descricao: '',
            tipo: '',
            fornecedor: '',
            plano: ''
        });
    };

    // Aplica os filtros de Regras ignorando uma chave específica (para gerar opções estilo Excel)
    const filtrarRegraExcecao = (chaveIgnorada) => {
        return regras.filter((item) => {
            const contratante = (item.contratanteNome || '- Geral -').toLowerCase();
            const unidade = (item.unidadeNome || '- Todas -').toLowerCase();
            const banco = (item.bancoNome || '- Todos -').toLowerCase();
            const descricao = (item.termoDescricao || '- Qualquer -').toLowerCase();
            const tipo = (item.termoTipo || '- Qualquer -').toLowerCase();
            const fornecedor = (item.termoFornecedor || '- Qualquer -').toLowerCase();
            const plano = (item.destino || item.planoConta || '').toLowerCase();

            return (
                (chaveIgnorada === 'contratante' || contratante.includes(filtrosRegra.contratante.toLowerCase().trim())) &&
                (chaveIgnorada === 'unidade' || unidade.includes(filtrosRegra.unidade.toLowerCase().trim())) &&
                (chaveIgnorada === 'banco' || banco.includes(filtrosRegra.banco.toLowerCase().trim())) &&
                (chaveIgnorada === 'descricao' || descricao.includes(filtrosRegra.descricao.toLowerCase().trim())) &&
                (chaveIgnorada === 'tipo' || tipo.includes(filtrosRegra.tipo.toLowerCase().trim())) &&
                (chaveIgnorada === 'fornecedor' || fornecedor.includes(filtrosRegra.fornecedor.toLowerCase().trim())) &&
                (chaveIgnorada === 'plano' || plano.includes(filtrosRegra.plano.toLowerCase().trim()))
            );
        });
    };

    // Opções dinâmicas estilo Excel para os filtros de Regras
    const opcoesRegraContratante = useMemo(() => {
        const dados = filtrarRegraExcecao('contratante');
        return Array.from(new Set(dados.map(r => r.contratanteNome || '- Geral -').filter(Boolean)));
    }, [regras, filtrosRegra]);

    const opcoesRegraUnidade = useMemo(() => {
        const dados = filtrarRegraExcecao('unidade');
        return Array.from(new Set(dados.map(r => r.unidadeNome || '- Todas -').filter(Boolean)));
    }, [regras, filtrosRegra]);

    const opcoesRegraBanco = useMemo(() => {
        const dados = filtrarRegraExcecao('banco');
        return Array.from(new Set(dados.map(r => r.bancoNome || '- Todos -').filter(Boolean)));
    }, [regras, filtrosRegra]);

    const opcoesRegraDescricao = useMemo(() => {
        const dados = filtrarRegraExcecao('descricao');
        return Array.from(new Set(dados.map(r => r.termoDescricao || '- Qualquer -').filter(Boolean)));
    }, [regras, filtrosRegra]);

    const opcoesRegraTipo = useMemo(() => {
        const dados = filtrarRegraExcecao('tipo');
        return Array.from(new Set(dados.map(r => r.termoTipo || '- Qualquer -').filter(Boolean)));
    }, [regras, filtrosRegra]);

    const opcoesRegraFornecedor = useMemo(() => {
        const dados = filtrarRegraExcecao('fornecedor');
        return Array.from(new Set(dados.map(r => r.termoFornecedor || '- Qualquer -').filter(Boolean)));
    }, [regras, filtrosRegra]);

    const opcoesRegraPlano = useMemo(() => {
        const dados = filtrarRegraExcecao('plano');
        return Array.from(new Set(dados.map(r => r.destino || r.planoConta).filter(Boolean)));
    }, [regras, filtrosRegra]);

    // Schema de filtros para o FiltroBar de Regras
    const schemaFiltroRegra = [
        { key: "contratante", label: "Contratante", tipo: "inputlist", placeholder: "Buscar contratante...", options: opcoesRegraContratante },
        { key: "unidade", label: "Unidade", tipo: "inputlist", placeholder: "Buscar unidade...", options: opcoesRegraUnidade },
        { key: "banco", label: "Banco", tipo: "inputlist", placeholder: "Buscar banco...", options: opcoesRegraBanco },
        { key: "descricao", label: "Descrição", tipo: "inputlist", placeholder: "Buscar descrição...", options: opcoesRegraDescricao },
        { key: "tipo", label: "Tipo", tipo: "inputlist", placeholder: "Buscar tipo...", options: opcoesRegraTipo },
        { key: "fornecedor", label: "Fornecedor", tipo: "inputlist", placeholder: "Buscar fornecedor...", options: opcoesRegraFornecedor },
        { key: "plano", label: "Plano de Conta", tipo: "inputlist", placeholder: "Buscar plano...", options: opcoesRegraPlano }
    ];

    // Filtragem final aplicada à tabela de Regras
    const regrasFiltradas = useMemo(() => {
        return regras.filter((item) => {
            const contratante = (item.contratanteNome || '- Geral -').toLowerCase();
            const unidade = (item.unidadeNome || '- Todas -').toLowerCase();
            const banco = (item.bancoNome || '- Todos -').toLowerCase();
            const descricao = (item.termoDescricao || '- Qualquer -').toLowerCase();
            const tipo = (item.termoTipo || '- Qualquer -').toLowerCase();
            const fornecedor = (item.termoFornecedor || '- Qualquer -').toLowerCase();
            const plano = (item.destino || item.planoConta || '').toLowerCase();

            return (
                contratante.includes(filtrosRegra.contratante.toLowerCase().trim()) &&
                unidade.includes(filtrosRegra.unidade.toLowerCase().trim()) &&
                banco.includes(filtrosRegra.banco.toLowerCase().trim()) &&
                descricao.includes(filtrosRegra.descricao.toLowerCase().trim()) &&
                tipo.includes(filtrosRegra.tipo.toLowerCase().trim()) &&
                fornecedor.includes(filtrosRegra.fornecedor.toLowerCase().trim()) &&
                plano.includes(filtrosRegra.plano.toLowerCase().trim())
            );
        });
    }, [regras, filtrosRegra]);

    // ==========================================================
    // FILTROS - PLANO DE CONTAS
    // ==========================================================

    const handleFilterChange = (key, value) => {
        setFiltrosPlano((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltrosPlano({
            plano: '',
            grupo: '',
            edre: '',
            dfc: '',
            efolha: ''
        });
    };

    // Aplica os filtros do Plano de Contas ignorando uma chave específica
    const filtrarPlanoExcecao = (chaveIgnorada) => {
        return planoContas.filter((item) => {
            const plano = (item.planoConta || item.planoconta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || item.eFolha || '').toLowerCase();

            return (
                (chaveIgnorada === 'plano' || plano.includes(filtrosPlano.plano.toLowerCase().trim())) &&
                (chaveIgnorada === 'grupo' || grupo.includes(filtrosPlano.grupo.toLowerCase().trim())) &&
                (chaveIgnorada === 'edre' || edre.includes(filtrosPlano.edre.toLowerCase().trim())) &&
                (chaveIgnorada === 'dfc' || dfc.includes(filtrosPlano.dfc.toLowerCase().trim())) &&
                (chaveIgnorada === 'efolha' || efolha.includes(filtrosPlano.efolha.toLowerCase().trim()))
            );
        });
    };

    // Opções dinâmicas estilo Excel para os filtros do Plano de Contas
    const opcoesPlano = useMemo(() => {
        const dados = filtrarPlanoExcecao('plano');
        return Array.from(new Set(dados.map(p => p.planoConta || p.planoconta).filter(Boolean)));
    }, [planoContas, filtrosPlano]);

    const opcoesGrupo = useMemo(() => {
        const dados = filtrarPlanoExcecao('grupo');
        return Array.from(new Set(dados.map(p => p.grupoConta).filter(Boolean)));
    }, [planoContas, filtrosPlano]);

    const opcoesEDre = useMemo(() => {
        const dados = filtrarPlanoExcecao('edre');
        return Array.from(new Set(dados.map(p => p.edre).filter(Boolean)));
    }, [planoContas, filtrosPlano]);

    const opcoesDfc = useMemo(() => {
        const dados = filtrarPlanoExcecao('dfc');
        return Array.from(new Set(dados.map(p => p.dfc).filter(Boolean)));
    }, [planoContas, filtrosPlano]);

    const opcoesEFolha = useMemo(() => {
        const dados = filtrarPlanoExcecao('efolha');
        return Array.from(new Set(dados.map(p => p.efolha || p.eFolha).filter(Boolean)));
    }, [planoContas, filtrosPlano]);

    // Schema de filtros para o FiltroBar do Plano de Contas
    const schemaFiltroPlano = [
        { key: "plano", label: "Plano de Conta", tipo: "inputlist", placeholder: "Buscar plano...", options: opcoesPlano },
        { key: "grupo", label: "Grupo de Conta", tipo: "inputlist", placeholder: "Buscar grupo...", options: opcoesGrupo },
        { key: "edre", label: "E-DRE", tipo: "inputlist", placeholder: "Buscar E-DRE...", options: opcoesEDre },
        { key: "dfc", label: "DFC", tipo: "inputlist", placeholder: "Buscar DFC...", options: opcoesDfc },
        { key: "efolha", label: "E-Folha", tipo: "inputlist", placeholder: "Buscar E-Folha...", options: opcoesEFolha }
    ];

    // Filtragem final aplicada à tabela de Plano de Contas
    const planoContasFiltrados = useMemo(() => {
        return planoContas.filter((item) => {
            const plano = (item.planoConta || item.planoconta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || item.eFolha || '').toLowerCase();

            return (
                plano.includes(filtrosPlano.plano.toLowerCase().trim()) &&
                grupo.includes(filtrosPlano.grupo.toLowerCase().trim()) &&
                edre.includes(filtrosPlano.edre.toLowerCase().trim()) &&
                dfc.includes(filtrosPlano.dfc.toLowerCase().trim()) &&
                efolha.includes(filtrosPlano.efolha.toLowerCase().trim())
            );
        });
    }, [planoContas, filtrosPlano]);

    // ==========================================================
    // MODAL DE CADASTRO / EDIÇÃO DE REGRA
    // ==========================================================

    const fecharModal = () => {
        setTermoDescricao('');
        setTermoTipo('');
        setTermoFornecedor('');
        setPlanoContaTexto('');
        setContratanteTexto('');
        setUnidadeTexto('');
        setBancoTexto('');
        setRegraEmEdicao(null);
        setModalAberto(false);
    };

    // ==========================================================
    // CHAMADAS À API
    // ==========================================================

    // 1. Busca do Plano de Contas
    const carregarPlanoContas = async () => {
        if (!token) return;
        setCarregandoPlano(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/planocontas`, {
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

    // 2. Busca dos cadastros auxiliares (Contratantes, Unidades, Bancos)
    const carregarListasAuxiliares = async () => {
        if (!token) return;
        try {
            const headers = { Authorization: `Bearer ${token}` };

            // Contratantes
            const resCont = await fetch(`${API_BASE}/api/contratantes`, { headers });
            if (resCont.ok) {
                const dadosCont = await resCont.json();
                setContratantes(Array.isArray(dadosCont) ? dadosCont : dadosCont.dados || []);
            }

            // Unidades (AJUSTADO E HABILITADO)
            const resUni = await fetch(`${API_BASE}/api/unidades`, { headers });
            if (resUni.ok) {
                const dadosUni = await resUni.json();
                setUnidades(Array.isArray(dadosUni) ? dadosUni : dadosUni.dados || []);
            }

            // Bancos (AJUSTADO E HABILITADO)
            const resBanc = await fetch(`${API_BASE}/api/bancos`, { headers });
            if (resBanc.ok) {
                const dadosBanc = await resBanc.json();
                setBancos(Array.isArray(dadosBanc) ? dadosBanc : dadosBanc.dados || []);
            }
        } catch (err) {
            console.error("Erro ao carregar listas auxiliares:", err);
        }
    };

    // 3. Busca das Regras
    const carregarRegras = async () => {
        if (!token) return;
        setCarregandoRegras(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/regras-planocontas`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar regras");
            const dados = await res.json();
            
            // Garante suporte tanto para lista direta quanto para { dados: [...] } ou { regras: [...] }
            const listaRegras = Array.isArray(dados) 
                ? dados 
                : (dados.dados || dados.regras || []);

            setRegras(listaRegras);
        } catch (err) {
            console.error("Erro ao carregar regras:", err);
        } finally {
            setCarregandoRegras(false);
        }
    };

    // 4. Salvar nova regra ou edição
    const handleSalvarRegra = async (e) => {
        e.preventDefault();

        if (!termoDescricao.trim() && !termoTipo.trim() && !termoFornecedor.trim()) {
            alert("Preencha ao menos um dos termos: Descrição, Tipo ou Fornecedor!");
            return;
        }

        // --- VALIDAÇÃO DO PLANO DE CONTAS ---
        if (!planoContaTexto || !planoContaTexto.trim()) {
            alert("Por favor, selecione um Plano de Contas válido!");
            return;
        }

        const textoPlano = planoContaTexto.trim().toLowerCase();
        const contaEncontrada = planoContas.find(p =>
            String(p.planoConta || p.planoconta || "").trim().toLowerCase() === textoPlano
        );

        if (!contaEncontrada) {
            alert("Plano de Contas não encontrado! Selecione uma opção válida da lista.");
            return;
        }

        // --- VALIDAÇÃO DO CONTRATANTE ---
        let idContratante = null;
        if (contratanteTexto && contratanteTexto.trim() !== '') {
            const textoCont = contratanteTexto.trim().toLowerCase();
            const contratanteEncontrado = contratantes.find(c =>
                String(c.nome || c.razaoSocial || "").trim().toLowerCase() === textoCont
            );

            if (!contratanteEncontrado) {
                alert("O contratante digitado não existe! Selecione uma opção válida ou deixe em branco.");
                return;
            }
            idContratante = contratanteEncontrado.id;
        }

        // --- VALIDAÇÃO DA UNIDADE ---
        let idUnidade = null;
        if (unidadeTexto && unidadeTexto.trim() !== '') {
            const textoUni = unidadeTexto.trim().toLowerCase();
            const unidadeEncontrada = unidades.find(u =>
                String(u.nome || u.descricao || "").trim().toLowerCase() === textoUni
            );

            if (!unidadeEncontrada) {
                alert("A unidade digitada não existe! Selecione uma opção válida ou deixe em branco.");
                return;
            }
            idUnidade = unidadeEncontrada.id;
        }

        // --- VALIDAÇÃO DO BANCO ---
        let idBanco = null;
        if (bancoTexto && bancoTexto.trim() !== '') {
            const textoBanc = bancoTexto.trim().toLowerCase();
            const bancoEncontrado = bancos.find(b =>
                String(b.nome || b.codigo || "").trim().toLowerCase() === textoBanc
            );

            if (!bancoEncontrado) {
                alert("O banco digitado não existe! Selecione uma opção válida ou deixe em branco.");
                return;
            }
            idBanco = bancoEncontrado.id;
        }

        // --- MONTAGEM DO PAYLOAD ---
        const isEdicao = Boolean(regraEmEdicao);
        const url = isEdicao
            ? `${API_BASE}/api/${banco}/regras-planocontas/${regraEmEdicao.id}`
            : `${API_BASE}/api/${banco}/regras-planocontas`;

        const metodo = isEdicao ? 'PUT' : 'POST';

        const payload = {
            termoDescricao: termoDescricao.trim() || null,
            termoTipo: termoTipo.trim() || null,
            termoFornecedor: termoFornecedor.trim() || null,
            planoContaId: Number(contaEncontrada.id),
            contratanteId: idContratante ? Number(idContratante) : null,
            unidadeId: idUnidade ? Number(idUnidade) : null,
            bancoId: idBanco ? Number(idBanco) : null
        };

        setSalvando(true);
        try {
            const res = await fetch(url, {
                method: metodo,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const dados = await res.json();

            if (!res.ok) {
                const msg = typeof dados.detail === 'string' ? dados.detail : JSON.stringify(dados.detail);
                throw new Error(msg || "Erro ao salvar alteração.");
            }

            alert(isEdicao ? "Regra atualizada com sucesso!" : "Regra cadastrada com sucesso!");

            fecharModal();
            carregarRegras();
        } catch (err) {
            alert(`Falha ao salvar: ${err.message}`);
        } finally {
            setSalvando(false);
        }
    };

    const handleEditarRegra = (row) => {
        setRegraEmEdicao(row);
        setTermoDescricao(row.termoDescricao || '');
        setTermoTipo(row.termoTipo || '');
        setTermoFornecedor(row.termoFornecedor || '');
        setPlanoContaTexto(row.destino || row.planoConta || '');
        setContratanteTexto(row.contratanteNome || '');
        setUnidadeTexto(row.unidadeNome || '');
        setBancoTexto(row.bancoNome || '');
        setModalAberto(true);
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
    // COLUNAS DAS TABELAS
    // ==========================================================

    const colunasPlanoContas = [
        { label: "Plano de Contas", key: "planoConta", width: "30%" },
        { label: "Grupo de Contas", key: "grupoConta", width: "25%" },
        { label: "e-DRE", key: "edre", width: "15%" },
        { label: "DFC", key: "dfc", width: "15%" },
        { label: "e-Folha", key: "efolha", width: "15%" }
    ];

    const colunasRegras = [
        {
            label: "Contratante",
            key: "contratanteNome",
            width: "15%",
            Cell: ({ row }) => row.contratanteNome || <span>- Geral -</span>
        },
        {
            label: "Unidade",
            key: "unidadeNome",
            width: "12%",
            Cell: ({ row }) => row.unidadeNome || <span>- Todas -</span>
        },
        {
            label: "Banco",
            key: "bancoNome",
            width: "12%",
            Cell: ({ row }) => row.bancoNome || <span>- Todos -</span>
        },
        {
            label: "Descrição",
            key: "termoDescricao",
            width: "18%",
            Cell: ({ row }) => row.termoDescricao || <span>- Qualquer -</span>
        },
        {
            label: "Tipo",
            key: "termoTipo",
            width: "18%",
            Cell: ({ row }) => row.termoTipo || <span>- Qualquer -</span>
        },
        {
            label: "Fornecedor",
            key: "termoFornecedor",
            width: "18%",
            Cell: ({ row }) => row.termoFornecedor || <span>- Qualquer -</span>
        },
        {
            label: "Plano de Contas",
            key: "destino",
            width: "15%",
            Cell: ({ row }) => (
                <span>
                    {row.destino || row.planoConta || `ID: ${row.planoContaId}`}
                </span>
            )
        },
        {
            label: "Ações",
            key: "acoes",
            width: "120px", // É recomendável usar largura fixa em px quando a coluna é sticky
            style: { 
                textAlign: "center",
                position: "sticky",
                right: 0,
                zIndex: 2,
                boxShadow: "-2px 0 5px rgba(0,0,0,0.05)" // Opcional: efeito visual de sombra no limite do scroll
            },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <Button onClick={() => handleEditarRegra(row)}>
                        Editar
                    </Button>
                    <Button onClick={() => handleExcluirRegra(row.id)} style={{ backgroundColor: "#f87171" }}>
                        Excluir
                    </Button>
                </div>
            )
        }
    ];

    // ==========================================================
    // EFFECTS
    // ==========================================================

    useEffect(() => {
        carregarPlanoContas();
        carregarRegras();
        carregarListasAuxiliares();
    }, [token, banco]);

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* SEÇÃO 1: REGRAS MAPEADAS */}
            <Card title="Regras de Mapeamento do Plano de Contas">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <p>Regras de Mapeamento de Plano de Contas</p>
                    <Button onClick={() => setModalAberto(true)}>
                        + Nova Regra
                    </Button>
                </div>

                <FiltroBar
                    schema={schemaFiltroRegra}
                    filtros={filtrosRegra}
                    onChange={handleFilterRegraChange}
                    onLimpar={limparFiltrosRegra}
                />

                {carregandoRegras ? (
                    <div style={estiloCarregando}>Carregando regras...</div>
                ) : (
                    <Table columns={colunasRegras} data={regrasFiltradas} />
                )}
            </Card>

            {/* MODAL DE CADASTRO / EDIÇÃO */}
            {modalAberto && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: "var(--bg-color2)", borderRadius: "8px", padding: "24px",
                        width: "100%", maxWidth: "560px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                        maxHeight: "90vh", overflowY: "auto"
                    }}>
                        <h3 style={{ marginBottom: "16px", color: "var(--text-color3)" }}>
                            {regraEmEdicao ? "Editar Regra" : "Nova Regra de Mapeamento"}
                        </h3>

                        <form onSubmit={handleSalvarRegra} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {/* Datalist Contratante */}
                            <div>
                                <Inputlist
                                    id="modal-contratantes"
                                    label="Contratante (Opcional - Vazio para Regra Geral)"
                                    placeholder="Digite ou escolha o contratante..."
                                    value={contratanteTexto}
                                    onChange={(e) => setContratanteTexto(e.target.value)}
                                    options={contratantes}
                                    valueKey={(c) => c.nome || c.razaoSocial || ""}
                                />
                            </div>

                            {/* Datalist Unidade */}
                            <div>
                                <Inputlist
                                    id="modal-unidades"
                                    label="Unidade (Opcional - Vazio para Todas)"
                                    placeholder="Digite ou escolha a unidade..."
                                    value={unidadeTexto}
                                    onChange={(e) => setUnidadeTexto(e.target.value)}
                                    options={unidades}
                                    valueKey={(u) => u.nome || u.razaoSocial || ""}
                                />
                            </div>

                            {/* Datalist Banco */}
                            <div>
                                <Inputlist
                                    id="modal-bancos"
                                    label="Banco (Opcional - Vazio para Todos)"
                                    placeholder="Digite ou escolha o banco..."
                                    value={bancoTexto}
                                    onChange={(e) => setBancoTexto(e.target.value)}
                                    options={bancos}
                                    valueKey={(b) => b.nome || b.codigo || ""}
                                />
                            </div>

                            {/* Termo Descrição */}
                            <div>
                                <label className="form-label">Termo na Descrição:</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="Ex: TARIFA, ALUGUEL..."
                                    value={termoDescricao}
                                    onChange={(e) => setTermoDescricao(e.target.value)}
                                />
                            </div>

                            {/* Termo Tipo */}
                            <div>
                                <label className="form-label">Termo no Tipo:</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="Ex: TARIFA, ALUGUEL..."
                                    value={termoTipo}
                                    onChange={(e) => setTermoTipo(e.target.value)}
                                />
                            </div>

                            {/* Termo Fornecedor */}
                            <div>
                                <label className="form-label">Termo no Fornecedor:</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    placeholder="Ex: BANCO DO BRASIL"
                                    value={termoFornecedor}
                                    onChange={(e) => setTermoFornecedor(e.target.value)}
                                />
                            </div>

                            {/* Datalist Plano de Contas */}
                            <div>
                                <Inputlist
                                    id="modal-plano-contas"
                                    label="Plano de Contas (Destino) *"
                                    placeholder="Digite ou escolha o plano de contas..."
                                    value={planoContaTexto}
                                    onChange={(e) => setPlanoContaTexto(e.target.value)}
                                    options={planoContas}
                                    valueKey={(p) => p.planoConta || p.planoconta || ""}
                                    required
                                />
                            </div>

                            {/* Botões */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                                <Button type="button" onClick={fecharModal}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={salvando}>
                                    {salvando ? "Salvando..." : "Salvar Regra"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SEÇÃO 2: LISTAGEM PLANO DE CONTAS */}
            <Card title="Gerenciamento do Plano de Contas">
                <div className="card-filtros mb-4">
                    <div className="form-row">
                        <FiltroBar
                            schema={schemaFiltroPlano}
                            filtros={filtrosPlano}
                            onChange={handleFilterChange}
                            onLimpar={limparFiltros}
                        />
                    </div>
                </div>

                {carregandoPlano ? (
                    <div style={estiloCarregando}>Carregando plano...</div>
                ) : (
                    <Table columns={colunasPlanoContas} data={planoContasFiltrados} />
                )}
            </Card>
        </div>
    );
}