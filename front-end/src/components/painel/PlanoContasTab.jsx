import { useState, useEffect, useMemo } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import Button from "../button/Button";
import Inputlist from "../Inputlist/Inputlist";
import { API_BASE } from "../../context/AuthContext";

export default function PlanoContasTab({ token, banco }) {
    const [planoContas, setPlanoContas] = useState([]);
    const [carregandoPlano, setCarregandoPlano] = useState(false);

    // Estados dos Filtros
    const [filtroPlano, setFiltroPlano] = useState('');
    const [filtroGrupo, setFiltroGrupo] = useState('');
    const [filtroEDre, setFiltroEDre] = useState('');
    const [filtroDfc, setFiltroDfc] = useState('');
    const [filtroEFolha, setFiltroEFolha] = useState('');

    // Função auxiliar para aplicar filtros ignorando uma chave específica
    const filtrarPlanoExcecao = (chaveIgnorada) => {
        return planoContas.filter((item) => {
            const plano = (item.planoConta || item.planoconta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || item.eFolha || '').toLowerCase();

            return (
                (chaveIgnorada === 'plano' || plano.includes(filtroPlano.toLowerCase().trim())) &&
                (chaveIgnorada === 'grupo' || grupo.includes(filtroGrupo.toLowerCase().trim())) &&
                (chaveIgnorada === 'edre' || edre.includes(filtroEDre.toLowerCase().trim())) &&
                (chaveIgnorada === 'dfc' || dfc.includes(filtroDfc.toLowerCase().trim())) &&
                (chaveIgnorada === 'efolha' || efolha.includes(filtroEFolha.toLowerCase().trim()))
            );
        });
    };

    // Opções dinâmicas estilo Excel
    const opcoesPlano = useMemo(() => {
        const dados = filtrarPlanoExcecao('plano');
        return Array.from(new Set(dados.map(p => p.planoConta || p.planoconta).filter(Boolean)));
    }, [planoContas, filtroGrupo, filtroEDre, filtroDfc, filtroEFolha]);

    const opcoesGrupo = useMemo(() => {
        const dados = filtrarPlanoExcecao('grupo');
        return Array.from(new Set(dados.map(p => p.grupoConta).filter(Boolean)));
    }, [planoContas, filtroPlano, filtroEDre, filtroDfc, filtroEFolha]);

    const opcoesEDre = useMemo(() => {
        const dados = filtrarPlanoExcecao('edre');
        return Array.from(new Set(dados.map(p => p.edre).filter(Boolean)));
    }, [planoContas, filtroPlano, filtroGrupo, filtroDfc, filtroEFolha]);

    const opcoesDfc = useMemo(() => {
        const dados = filtrarPlanoExcecao('dfc');
        return Array.from(new Set(dados.map(p => p.dfc).filter(Boolean)));
    }, [planoContas, filtroPlano, filtroGrupo, filtroEDre, filtroEFolha]);

    const opcoesEFolha = useMemo(() => {
        const dados = filtrarPlanoExcecao('efolha');
        return Array.from(new Set(dados.map(p => p.efolha || p.eFolha).filter(Boolean)));
    }, [planoContas, filtroPlano, filtroGrupo, filtroEDre, filtroDfc]);

    const limparFiltros = () => {
        setFiltroPlano('');
        setFiltroGrupo('');
        setFiltroEDre('');
        setFiltroDfc('');
        setFiltroEFolha('');
    };

    // ==========================================
    // LÓGICA DE FILTRAGEM DO PLANO DE CONTAS
    // ==========================================
    const planoContasFiltrados = useMemo(() => {
        return planoContas.filter((item) => {
            const plano = (item.planoConta || item.planoconta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || item.eFolha || '').toLowerCase();

            return (
                plano.includes(filtroPlano.toLowerCase().trim()) &&
                grupo.includes(filtroGrupo.toLowerCase().trim()) &&
                edre.includes(filtroEDre.toLowerCase().trim()) &&
                dfc.includes(filtroDfc.toLowerCase().trim()) &&
                efolha.includes(filtroEFolha.toLowerCase().trim())
            );
        });
    }, [planoContas, filtroPlano, filtroGrupo, filtroEDre, filtroDfc, filtroEFolha]);

    const [regras, setRegras] = useState([]);
    const [carregandoRegras, setCarregandoRegras] = useState(false);

    // Estados para Contratantes
    const [contratantes, setContratantes] = useState([]);

    // Estados do Formulário de Nova Regra
    const [modalAberto, setModalAberto] = useState(false);
    const fecharModal = () => {
        setTermoDescricao('');
        setTermoFornecedor('');
        setPlanoContaTexto('');
        setContratanteTexto('');
        setRegraEmEdicao(null);
        setModalAberto(false);
    };
    const [termoDescricao, setTermoDescricao] = useState('');
    const [termoFornecedor, setTermoFornecedor] = useState('');
    const [planoContaTexto, setPlanoContaTexto] = useState('');
    const [contratanteTexto, setContratanteTexto] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [regraEmEdicao, setRegraEmEdicao] = useState(null);

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

    // 2. Busca dos Contratantes
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
            setRegras(Array.isArray(dados) ? dados : dados.regras || []);
        } catch (err) {
            console.error("Erro ao carregar regras:", err);
        } finally {
            setCarregandoRegras(false);
        }
    };

    // 4. Salvar Nova Regra
    const handleSalvarRegra = async (e) => {
        e.preventDefault();

        if (!termoDescricao.trim() && !termoFornecedor.trim()) {
            alert("Preencha ao menos o Termo na Descrição ou no Fornecedor!");
            return;
        }

        // --- 1. BUSCA E VALIDAÇÃO DO PLANO DE CONTAS ---
        if (!planoContaTexto || !planoContaTexto.trim()) {
            alert("Por favor, selecione ou digite um Plano de Contas válido!");
            return;
        }

        const textoPlanoDigitado = planoContaTexto.trim().toLowerCase();
        const contaEncontrada = planoContas.find(p => 
            String(p.planoConta || p.planoconta || "").trim().toLowerCase() === textoPlanoDigitado
        );

        if (!contaEncontrada) {
            alert("Plano de Contas não encontrado! Selecione uma opção válida da lista.");
            return;
        }

        // --- 2. BUSCA E VALIDAÇÃO DO CONTRATANTE ---
        let idContratante = null;
        if (contratanteTexto && contratanteTexto.trim() !== '') {
            const textoContratanteDigitado = contratanteTexto.trim().toLowerCase();
            const contratanteEncontrado = contratantes.find(c => 
                String(c.nome || c.razaoSocial || "").trim().toLowerCase() === textoContratanteDigitado
            );

            if (!contratanteEncontrado) {
                alert("O contratante digitado não existe! Selecione uma opção válida da lista ou deixe em branco para aplicar a todos.");
                return;
            }

            idContratante = contratanteEncontrado.id;
        }

        // --- 3. MONTAGEM DO PAYLOAD E DEFINIÇÃO DE ENDPOINT/MÉTODO ---
        const isEdicao = Boolean(regraEmEdicao);
        const url = isEdicao 
            ? `${API_BASE}/api/${banco}/regras-planocontas/${regraEmEdicao.id}`
            : `${API_BASE}/api/${banco}/regras-planocontas`;

        const metodo = isEdicao ? 'PUT' : 'POST';

        const payload = {
            termoDescricao: termoDescricao.trim() || null,
            termoFornecedor: termoFornecedor.trim() || null,
            planoContaId: Number(contaEncontrada.id),
            contratanteId: idContratante ? Number(idContratante) : null
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
        setTermoFornecedor(row.termoFornecedor || '');
        setPlanoContaTexto(row.destino || row.planoConta || '');
        setContratanteTexto(row.contratanteNome || '');
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

    // Colunas Tabela Plano de Contas
    const colunasPlanoContas = [
        { label: "Plano de Contas", key: "planoConta", width: "30%" },
        { label: "Grupo de Contas", key: "grupoConta", width: "25%" },
        { label: "e-DRE", key: "edre", width: "15%" },
        { label: "DFC", key: "dfc", width: "15%" },
        { label: "e-Folha", key: "efolha", width: "15%" }
    ];

    // Colunas Tabela de Regras
    const colunasRegras = [
        { 
            label: "Contratante", 
            key: "contratanteNome", 
            width: "20%",
            Cell: ({ row }) => row.contratanteNome || row.contratanteId || (
                <span>- Regra geral -</span>
            )
        },
        { 
            label: "Descrição", 
            key: "termoDescricao", 
            width: "22%",
            Cell: ({ row }) => row.termoDescricao || (
                <span>- Qualquer -</span>
            )
        },
        { 
            label: "Fornecedor", 
            key: "termoFornecedor", 
            width: "22%",
            Cell: ({ row }) => row.termoFornecedor || (
                <span>- Qualquer -</span>
            )
        },
        { 
            label: "Plano de Contas", 
            key: "destino", 
            width: "26%",
            Cell: ({ row }) => (
                <span>
                    {row.destino || row.planoConta || row.planoContaNome || `ID: ${row.planoContaId}`}
                </span>
            )
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
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

    useEffect(() => {
        carregarPlanoContas();
        carregarRegras();
        carregarContratantes();
    }, [token, banco]);

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

                {carregandoRegras ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>Carregando regras...</div>
                ) : (
                    <Table columns={colunasRegras} data={regras} />
                )}
            </Card>

            {/* MODAL DE CADASTRO */}
            {modalAberto && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: "var(--bg-color2)", borderRadius: "8px", padding: "24px",
                        width: "100%", maxWidth: "520px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)"
                    }}>
                        <h3 style={{ marginBottom: "16px", color: "var(--text-color3)" }}>
                            {regraEmEdicao ? "Editar Regra" : "Nova Regra: Descrição + Fornecedor = Plano"}
                        </h3>

                        <form onSubmit={handleSalvarRegra} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {/* Termo Descrição */}
                            <div>
                                <label className="form-label">
                                    1. Termo que contém na Descrição:
                                </label>
                                <input 
                                    className="form-input"
                                    type="text"
                                    placeholder="Ex: TARIFA, ALUGUEL..."
                                    value={termoDescricao}
                                    onChange={(e) => setTermoDescricao(e.target.value)}
                                />
                            </div>

                            {/* Termo Fornecedor */}
                            <div>
                                <label className="form-label">
                                    2. Termo que contém no Fornecedor:
                                </label>
                                <input 
                                    className="form-input"
                                    type="text"
                                    placeholder="Ex: BANCO DO BRASIL"
                                    value={termoFornecedor}
                                    onChange={(e) => setTermoFornecedor(e.target.value)}
                                />
                            </div>

                            {/* Datalist do Plano de Contas */}
                            <div>
                                <Inputlist
                                    id="modal-plano-contas"
                                    label="3. Plano de Contas (Destino) *"
                                    placeholder="Digite ou escolha o plano de contas..."
                                    value={planoContaTexto}
                                    onChange={(e) => setPlanoContaTexto(e.target.value)}
                                    options={planoContasFiltrados}
                                    valueKey={(p) => p.planoConta || p.planoconta || ""}
                                    required
                                />
                            </div>

                            {/* Datalist do Contratante */}
                            <div>
                                <Inputlist
                                    id="modal-contratantes"
                                    label="4. Contratante (Opcional - Vazio para regra Geral)"
                                    placeholder="Digite ou escolha o contratante..."
                                    value={contratanteTexto}
                                    onChange={(e) => setContratanteTexto(e.target.value)}
                                    options={contratantes}
                                    valueKey={(c) => c.nome || c.razaoSocial || ""}
                                />
                            </div>

                            {/* Botões do Form */}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h5 className="m-0">Filtrar Plano de Contas</h5>
                        <Button type="button" onClick={limparFiltros}>
                            Limpar Filtros
                        </Button>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <Inputlist
                                id="filtro-plano"
                                label="Plano de Conta"
                                placeholder="Buscar plano..."
                                value={filtroPlano}
                                onChange={(e) => setFiltroPlano(e.target.value)}
                                options={opcoesPlano}
                                valueKey={(item) => item}
                            />
                        </div>

                        <div className="form-group">
                            <Inputlist
                                id="filtro-grupo"
                                label="Grupo de Conta"
                                placeholder="Buscar grupo..."
                                value={filtroGrupo}
                                onChange={(e) => setFiltroGrupo(e.target.value)}
                                options={opcoesGrupo}
                                valueKey={(item) => item}
                            />
                        </div>

                        <div className="form-group">
                            <Inputlist
                                id="filtro-edre"
                                label="E-DRE"
                                placeholder="Buscar E-DRE..."
                                value={filtroEDre}
                                onChange={(e) => setFiltroEDre(e.target.value)}
                                options={opcoesEDre}
                                valueKey={(item) => item}
                            />
                        </div>

                        <div className="form-group">
                            <Inputlist
                                id="filtro-dfc"
                                label="DFC"
                                placeholder="Buscar DFC..."
                                value={filtroDfc}
                                onChange={(e) => setFiltroDfc(e.target.value)}
                                options={opcoesDfc}
                                valueKey={(item) => item}
                            />
                        </div>

                        <div className="form-group">
                            <Inputlist
                                id="filtro-efolha"
                                label="E-Folha"
                                placeholder="Buscar E-Folha..."
                                value={filtroEFolha}
                                onChange={(e) => setFiltroEFolha(e.target.value)}
                                options={opcoesEFolha}
                                valueKey={(item) => item}
                            />
                        </div>
                    </div>
                </div>

                {carregandoPlano ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>Carregando plano...</div>
                ) : (
                    <Table columns={colunasPlanoContas} data={planoContasFiltrados} />
                )}
            </Card>
        </div>
    );
}