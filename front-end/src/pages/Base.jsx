import { useEffect, useState, useMemo } from "react";
import Table from "../components/table/Table";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import FiltroBar from "../components/filtro/FiltroBar";
import { useAuth } from "../context/AuthContext";

export default function Base() {
    const { usuario, token } = useAuth();
    
    const [tipoVisao, setTipoVisao] = useState("dre");

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);
    const [bancoAtivo, setBancoAtivo] = useState("");

    // ESTADOS DE PERMISSÃO
    const [contratantesPermitidos, setContratantesPermitidos] = useState([]);
    const [requisicaoPermissaoConcluida, setRequisicaoPermissaoConcluida] = useState(false);

    // ESTADOS DOS FILTROS
    const [buscaGlobal, setBuscaGlobal] = useState("");
    const [filtrosColuna, setFiltrosColuna] = useState({});
    const [valorMin, setValorMin] = useState("");
    const [valorMax, setValorMax] = useState("");

    const API_URL = "http://127.0.0.1:8000/api";

    // ==================================================================
    // SCHEMAS DE COLUNAS POR TIPO DE VISÃO
    // ==================================================================
    const CONFIG_VISOES = {
        dre: {
            titulo: "Movimentações Financ. (DRE)",
            endpoint: "consolidado",
            colunasSemSelect: ["descricao", "obs", "valor", "data", "cpf"],
            columns: [
                { key: "contratante", label: "Contratante" },
                { key: "unidade", label: "Unidade" },
                { key: "banco", label: "Banco" },
                { key: "agencia", label: "Agência" },
                { key: "conta", label: "Conta" },
                { key: "data", label: "Data" },
                { key: "descricao", label: "Descrição" },
                { key: "obs", label: "Obs" },
                { key: "valor", label: "Valor" },
                { key: "tipo", label: "Tipo" },
                { key: "fornecedor", label: "Fornecedor" },
                { key: "cpf", label: "CPF" },
                { key: "planoConta", label: "Plano de Conta" },
                { key: "grupoConta", label: "Grupo de Conta" },
                { key: "edre", label: "E-DRE" },
            ]
        },
        folha: {
            titulo: "Folha de Pagamento",
            endpoint: "folha-pagamento-tabular",
            colunasSemSelect: ["nome", "cpf", "dataNascimento", "dataAdmissao", "descricao", "valor", "dataCompetencia", "dataCaixa"],
            columns: [
                { key: "contratante", label: "Contratante" },
                { key: "unidadeRegistro", label: "Unidade Registro" },
                { key: "unidadeAtuacao", label: "Unidade Atuação" },
                { key: "cnpj", label: "CNPJ" },
                { key: "nome", label: "Nome" },
                { key: "cpf", label: "CPF" },
                { key: "dataNascimento", label: "Data Nasc." },
                { key: "cboCargo", label: "CBO Cargo" },
                { key: "cargo", label: "Cargo" },
                { key: "departamento", label: "Departamento" },
                { key: "dataAdmissao", label: "Data Admissão" },
                { key: "descricao", label: "Descrição" },
                { key: "planoConta", label: "Plano de Conta" },
                { key: "grupoConta", label: "Grupo de Conta" },
                { key: "efolha", label: "E-Folha" },
                { key: "dataCompetencia", label: "Data Competência" },
                { key: "dataCaixa", label: "Data Caixa" },
                { key: "tipo", label: "Tipo" },
                { key: "valor", label: "Valor" }
            ]
        }
    };

    const configAtual = CONFIG_VISOES[tipoVisao];

    // ==================================================================
    // 1. CARREGA PERMISSÕES
    // ==================================================================
    useEffect(() => {
        if (!token || !usuario || !usuario.id) return;

        if (usuario.perfil === 3) {
            const nomePadrao = usuario.nome_contratante || "Minha Empresa";
            setContratantesPermitidos([{ id: usuario.contratanteId, nome: nomePadrao }]);
            setRequisicaoPermissaoConcluida(true);
            return;
        }

        if (usuario.perfil === 1 || Number(usuario.protegido) === 1) {
            setContratantesPermitidos([]);
            setRequisicaoPermissaoConcluida(true);
            return;
        }

        const url = `${API_URL}/usuarios/${usuario.id}/contratantes`;

        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => {
                const listaTratada = Array.isArray(data) ? data : [];
                const listaNormalizada = listaTratada.map((item) => {
                    if (item && item.contratante) return { id: item.contratante.id, nome: item.contratante.nome };
                    if (item && item.contratanteId && !item.nome) {
                        return { id: item.contratanteId, nome: item.nome_contratante || `Contratante ${item.contratanteId}` };
                    }
                    return { id: item?.id, nome: item?.nome };
                }).filter(item => item && item.nome);

                setContratantesPermitidos(listaNormalizada);
            })
            .catch((err) => console.error("Erro ao buscar permissões:", err))
            .finally(() => setRequisicaoPermissaoConcluida(true));
    }, [token, usuario]);

    // ==================================================================
    // 2. SOLICITA OS DADOS QUANDO A PERMISSÃO OU A VISÃO MUDAR
    // ==================================================================
    useEffect(() => {
        if (!requisicaoPermissaoConcluida) return;

        setLoading(true);
        setErro(null);
        // Limpa filtros ao trocar de aba
        limparFiltros();

        const bancoSalvo = localStorage.getItem("nash_selected_db");

        if (bancoSalvo) {
            fazerFetchConsolidado(bancoSalvo);
        } else {
            fetch(`${API_URL}/databases`)
                .then((res) => res.json())
                .then((dataBases) => {
                    if (dataBases.length > 0) {
                        localStorage.setItem("nash_selected_db", dataBases[0]);
                        fazerFetchConsolidado(dataBases[0]);
                    } else {
                        throw new Error("Nenhum banco de dados foi encontrado.");
                    }
                })
                .catch((err) => {
                    setErro(err.message);
                    setLoading(false);
                });
        }
    }, [requisicaoPermissaoConcluida, tipoVisao]);

    const fazerFetchConsolidado = (banco) => {
        setBancoAtivo(banco);

        const ehAdminOuSupremo = Number(usuario.perfil) === 1 || Number(usuario.protegido) === 1;

        if (!ehAdminOuSupremo && contratantesPermitidos.length === 0) {
            setData([]);
            setLoading(false);
            return;
        }

        let url = `${API_URL}/${banco}/${configAtual.endpoint}`;

        if (!ehAdminOuSupremo && contratantesPermitidos.length > 0) {
            const nomesVinculados = contratantesPermitidos.map(c => c.nome);
            url += `?contratante=${encodeURIComponent(nomesVinculados.join(","))}`;
        }

        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
                if (!res.ok) throw new Error(`Erro ao conectar na base [${banco}] para ${configAtual.titulo}.`);
                return res.json();
            })
            .then((dadosDoBanco) => {
                const listaDados = Array.isArray(dadosDoBanco) 
                ? dadosDoBanco 
                : (dadosDoBanco.folha || dadosDoBanco.dados || []);

            if (Array.isArray(listaDados) && listaDados.length > 0) {
                setData(listaDados);
            } else {
                setData([]);
                if (!Array.isArray(listaDados)) {
                    setErro(`Resposta inválida do servidor ao buscar ${configAtual.titulo}.`);
                }
            }
            setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setData([]);
                setErro(err.message);
                setLoading(false);
            });
    };

    // ==================================================================
    // LÓGICA DO FILTROBAR E OPÇÕES EXCEL
    // ==================================================================
    const obterOpcoesUnicasCruzadas = (chaveAtual) => {
        if (!Array.isArray(data)) return [];

        const dadosFiltradosParaEstaColuna = data.filter((item) => {
            if (buscaGlobal) {
                const termo = buscaGlobal.toLowerCase();
                if (!Object.values(item).some(val => String(val).toLowerCase().includes(termo))) return false;
            }

            const valorItem = Number(item.valor) || 0;
            if (valorMin && valorItem < Number(valorMin)) return false;
            if (valorMax && valorItem > Number(valorMax)) return false;

            for (const [chave, valorSelect] of Object.entries(filtrosColuna)) {
                if (chave !== chaveAtual && valorSelect && String(item[chave]) !== valorSelect) {
                    return false;
                }
            }
            return true;
        });

        const valores = dadosFiltradosParaEstaColuna.map(item => item[chaveAtual]).filter(Boolean);
        return [...new Set(valores)].sort();
    };

    const handleFiltroColunaChange = (key, value) => {
        setFiltrosColuna(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const limparFiltros = () => {
        setBuscaGlobal("");
        setFiltrosColuna({});
        setValorMin("");
        setValorMax("");
    };

    // Monta o Schema dinâmico para o FiltroBar com base nas colunas da visão ativa
    const schemaFiltrosDinamico = useMemo(() => {
        return configAtual.columns
            .filter(col => !configAtual.colunasSemSelect.includes(col.key))
            .map(col => ({
                key: col.key,
                label: col.label,
                tipo: "inputlist",
                placeholder: `Filtrar ${col.label.toLowerCase()}...`,
                options: obterOpcoesUnicasCruzadas(col.key)
            }));
    }, [configAtual, data, filtrosColuna, buscaGlobal, valorMin, valorMax]);

    // LÓGICA DE FILTRAGEM FINAL
    const dadosFiltrados = useMemo(() => {
        if (!Array.isArray(data)) return [];

        return data.filter((item) => {
            if (buscaGlobal) {
                const termo = buscaGlobal.toLowerCase();
                if (!Object.values(item).some(val => String(val).toLowerCase().includes(termo))) return false;
            }

            for (const [chave, valorSelect] of Object.entries(filtrosColuna)) {
                if (valorSelect && String(item[chave]) !== valorSelect) {
                    return false;
                }
            }

            const valorItem = Number(item.valor) || 0;
            if (valorMin && valorItem < Number(valorMin)) return false;
            if (valorMax && valorItem > Number(valorMax)) return false;

            return true;
        });
    }, [data, buscaGlobal, filtrosColuna, valorMin, valorMax]);

    return (
        <div className="page-container">

            {/* SELETOR DE VISÃO (DRE x FOLHA DE PAGAMENTO) */}
            <div style={{ display: "flex", gap: "10px"}}>
                <Button
                    variant="toggle"
                    active={tipoVisao === "dre"}
                    onClick={() => setTipoVisao("dre")}
                >
                    📈 Base E-DRE
                </Button>

                <Button
                    variant="toggle"
                    active={tipoVisao === "folha"}
                    onClick={() => setTipoVisao("folha")}
                >
                    👥 Folha de Pagamento
                </Button>
            </div>
            
            {!loading && !erro && data.length > 0 && (
                <Card title={`🔍 Filtrar - ${configAtual.titulo}`}>
                    
                    {/* BUSCA GERAL E MÍNIMO/MÁXIMO */}
                    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "16px" }}>
                        <div style={{ flex: "1", minWidth: "250px", display: "flex", flexDirection: "column", gap: "5px" }}>
                            <label className="form-label">Pesquisa Geral:</label>
                            <input 
                                className="form-input"
                                type="text"
                                placeholder="Digite um termo para buscar..."
                                value={buscaGlobal}
                                onChange={(e) => setBuscaGlobal(e.target.value)}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                <label className="form-label">Valor Mínimo (R$):</label>
                                <input 
                                    className="form-input"
                                    type="number"
                                    placeholder="0.00"
                                    value={valorMin}
                                    onChange={(e) => setValorMin(e.target.value)}
                                />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                                <label className="form-label">Valor Máximo (R$):</label>
                                <input 
                                    className="form-input"
                                    type="number"
                                    placeholder="99999"
                                    value={valorMax}
                                    onChange={(e) => setValorMax(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS DAS COLUNAS (FiltroBar) */}
                    <div className="card-filtros">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltrosDinamico}
                                filtros={filtrosColuna}
                                onChange={handleFiltroColunaChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>
                </Card>
            )}

            <Card title={`📊 ${configAtual.titulo}`}> 
                {loading ? (
                    <div className="state-container">
                        <span className="state-subtitle">🔄 Carregando registros do SQL Server...</span>
                    </div>
                ) : erro ? (
                    <div className="state-error">
                        <div className="state-error-icon">⚠️</div>
                        <strong className="state-error-title">Nenhum registro encontrado!</strong><br/>
                        Não foi possível carregar a tabela de <b>{configAtual.titulo}</b> no banco <b>{bancoAtivo}</b>.<br/>
                    </div>
                ) : data.length > 0 ? (
                    <div className="table-container">
                        <div className="table-info">
                            Exibindo <b>{dadosFiltrados.length}</b> de <b>{data.length}</b> registros.
                        </div>
                        <Table columns={configAtual.columns} data={dadosFiltrados} />
                    </div>
                ) : (
                    <div className="state-container">
                        <p className="state-subtitle">
                            Nenhum dado cadastrado para {configAtual.titulo}.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
}