import { useState, useEffect, useMemo } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import Button from "../button/Button";
import Inputlist from "../Inputlist/Inputlist";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";

export default function PlanoContasTab({ token, banco }) {
    const [planoContas, setPlanoContas] = useState([]);
    const [carregandoPlano, setCarregandoPlano] = useState(false);

    // Estados dos Filtros
    const [filtros, setFiltros] = useState({
        plano: '',
        grupo: '',
        edre: '',
        dfc: '',
        efolha: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            plano: '',
            grupo: '',
            edre: '',
            dfc: '',
            efolha: ''
        });
    };

    // Função auxiliar para aplicar filtros ignorando uma chave específica
    const filtrarPlanoExcecao = (chaveIgnorada) => {
        return planoContas.filter((item) => {
            const plano = (item.planoConta || item.planoconta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || item.eFolha || '').toLowerCase();

            return (
                (chaveIgnorada === 'plano' || plano.includes(filtros.plano.toLowerCase().trim())) &&
                (chaveIgnorada === 'grupo' || grupo.includes(filtros.grupo.toLowerCase().trim())) &&
                (chaveIgnorada === 'edre' || edre.includes(filtros.edre.toLowerCase().trim())) &&
                (chaveIgnorada === 'dfc' || dfc.includes(filtros.dfc.toLowerCase().trim())) &&
                (chaveIgnorada === 'efolha' || efolha.includes(filtros.efolha.toLowerCase().trim()))
            );
        });
    };

    // Opções dinâmicas estilo Excel
    const opcoesPlano = useMemo(() => {
        const dados = filtrarPlanoExcecao('plano');
        return Array.from(new Set(dados.map(p => p.planoConta || p.planoconta).filter(Boolean)));
    }, [planoContas, filtros]);

    const opcoesGrupo = useMemo(() => {
        const dados = filtrarPlanoExcecao('grupo');
        return Array.from(new Set(dados.map(p => p.grupoConta).filter(Boolean)));
    }, [planoContas, filtros]);

    const opcoesEDre = useMemo(() => {
        const dados = filtrarPlanoExcecao('edre');
        return Array.from(new Set(dados.map(p => p.edre).filter(Boolean)));
    }, [planoContas, filtros]);

    const opcoesDfc = useMemo(() => {
        const dados = filtrarPlanoExcecao('dfc');
        return Array.from(new Set(dados.map(p => p.dfc).filter(Boolean)));
    }, [planoContas, filtros]);

    const opcoesEFolha = useMemo(() => {
        const dados = filtrarPlanoExcecao('efolha');
        return Array.from(new Set(dados.map(p => p.efolha || p.eFolha).filter(Boolean)));
    }, [planoContas, filtros]);

    // Definição da estrutura do filtro genérico
    const schemaFiltroPlano = [
        {
            key: "plano",
            label: "Plano de Conta",
            tipo: "inputlist",
            placeholder: "Buscar plano...",
            options: opcoesPlano
        },
        {
            key: "grupo",
            label: "Grupo de Conta",
            tipo: "inputlist",
            placeholder: "Buscar grupo...",
            options: opcoesGrupo
        },
        {
            key: "edre",
            label: "E-DRE",
            tipo: "inputlist",
            placeholder: "Buscar E-DRE...",
            options: opcoesEDre
        },
        {
            key: "dfc",
            label: "DFC",
            tipo: "inputlist",
            placeholder: "Buscar DFC...",
            options: opcoesDfc
        },
        {
            key: "efolha",
            label: "E-Folha",
            tipo: "inputlist",
            placeholder: "Buscar E-Folha...",
            options: opcoesEFolha
        }
    ];

    // Lógica de Filtragem Final para a Tabela
    const planoContasFiltrados = useMemo(() => {
        return planoContas.filter((item) => {
            const plano = (item.planoConta || item.planoconta || '').toLowerCase();
            const grupo = (item.grupoConta || '').toLowerCase();
            const edre = (item.edre || '').toLowerCase();
            const dfc = (item.dfc || '').toLowerCase();
            const efolha = (item.efolha || item.eFolha || '').toLowerCase();

            return (
                plano.includes(filtros.plano.toLowerCase().trim()) &&
                grupo.includes(filtros.grupo.toLowerCase().trim()) &&
                edre.includes(filtros.edre.toLowerCase().trim()) &&
                dfc.includes(filtros.dfc.toLowerCase().trim()) &&
                efolha.includes(filtros.efolha.toLowerCase().trim())
            );
        });
    }, [planoContas, filtros]);

    const [regras, setRegras] = useState([]);
    const [carregandoRegras, setCarregandoRegras] = useState(false);

    // Estados para Listas Auxiliares (Datalists)
    const [contratantes, setContratantes] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [bancos, setBancos] = useState([]);

    // Estados do Formulário do Modal
    const [modalAberto, setModalAberto] = useState(false);
    const [termoDescricao, setTermoDescricao] = useState('');
    const [termoFornecedor, setTermoFornecedor] = useState('');
    const [planoContaTexto, setPlanoContaTexto] = useState('');
    const [contratanteTexto, setContratanteTexto] = useState('');
    const [unidadeTexto, setUnidadeTexto] = useState('');
    const [bancoTexto, setBancoTexto] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [regraEmEdicao, setRegraEmEdicao] = useState(null);

    const fecharModal = () => {
        setTermoDescricao('');
        setTermoFornecedor('');
        setPlanoContaTexto('');
        setContratanteTexto('');
        setUnidadeTexto('');
        setBancoTexto('');
        setRegraEmEdicao(null);
        setModalAberto(false);
    };

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

    // 2. Busca dos Cadastros Auxiliares (Contratantes, Unidades, Bancos)
    const carregarListasAuxiliares = async () => {
        try {
            const headers = { Authorization: `Bearer ${token}` };

            const [resCont, resUni, resBanc] = await Promise.all([
                fetch(`${API_BASE}/api/contratantes`, { headers }),
                //fetch(`${API_BASE}/api/${banco}/unidades`, { headers }).catch(() => null), //para quando cadastrar unidades
                //fetch(`${API_BASE}/api/${banco}/bancos`, { headers }).catch(() => null)
            ]);

            if (resCont && resCont.ok) {
                const dadosCont = await resCont.json();
                setContratantes(dadosCont);
            }

            if (resUni && resUni.ok) {
                const dadosUni = await resUni.json();
                setUnidades(Array.isArray(dadosUni) ? dadosUni : dadosUni.dados || []);
            }

            if (resBanc && resBanc.ok) {
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
            setRegras(Array.isArray(dados) ? dados : dados.regras || []);
        } catch (err) {
            console.error("Erro ao carregar regras:", err);
        } finally {
            setCarregandoRegras(false);
        }
    };

    // 4. Salvar Nova Regra ou Edição
    const handleSalvarRegra = async (e) => {
        e.preventDefault();

        if (!termoDescricao.trim() && !termoFornecedor.trim()) {
            alert("Preencha ao menos um dos termos: Descrição ou Fornecedor!");
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
        // --- VALIDAÇÃO DO BANCO ---
        let idBanco = null;
        if (bancoTexto && bancoTexto.trim() !== '') {
            const textoBanc = bancoTexto.trim().toLowerCase();
            const bancoEncontrado = bancos.find(b => 
                String(b.banco || b.descricao || b.nome || "").trim().toLowerCase() === textoBanc
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

    // Colunas Tabela Plano de Contas
    const colunasPlanoContas = [
        { label: "Plano de Contas", key: "planoConta", width: "30%" },
        { label: "Grupo de Contas", key: "grupoConta", width: "25%" },
        { label: "e-DRE", key: "edre", width: "15%" },
        { label: "DFC", key: "dfc", width: "15%" },
        { label: "e-Folha", key: "efolha", width: "15%" }
    ];

    // Colunas Tabela de Regras Atualizada
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
            width: "10%",
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
        carregarListasAuxiliares();
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
                                    valueKey={(u) => u.nome || u.descricao || ""}
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
                                    valueKey={(b) => b.banco || b.descricao || b.nome || ""}
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
                                    options={planoContasFiltrados}
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
                            filtros={filtros}
                            onChange={handleFilterChange}
                            onLimpar={limparFiltros}
                        />
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