import { useEffect, useState } from "react";
import Table from "../components/table/Table";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import Inputlist from "../components/Inputlist/Inputlist";
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
        setBuscaGlobal("");
        setFiltrosColuna({});
        setValorMin("");
        setValorMax("");

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
    }, [requisicaoPermissaoConcluida, tipoVisao]); // Dispara também na troca do tipoVisao

    const fazerFetchConsolidado = (banco) => {
        setBancoAtivo(banco);

        const ehAdminOuSupremo = Number(usuario.perfil) === 1 || Number(usuario.protegido) === 1;

        if (!ehAdminOuSupremo && contratantesPermitidos.length === 0) {
            setData([]);
            setLoading(false);
            return;
        }

        // URL Dinâmica usando o endpoint configurado na visão ativa
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
            } else if (Array.isArray(listaDados) && listaDados.length === 0) {
                setData([]);
            } else {
                setData([]);
                setErro(`Resposta inválida do servidor ao buscar ${configAtual.titulo}.`);
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

    // OPÇÕES ÚNICAS PARA FILTROS estilo EXCEL
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

    const handleFiltroColunaChange = (chave, valor) => {
        setFiltrosColuna(prev => ({
            ...prev,
            [chave]: valor
        }));
    };

    // LÓGICA DE FILTRAGEM FINAL
    const dadosFiltrados = Array.isArray(data) ? data.filter((item) => {
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
    }) : [];

    return (
        <div className="page-container">

            {/* SELETOR DE VISÃO (DRE x FOLHA DE PAGAMENTO) */}
            <div style={{ display: "flex", gap: "10px"}}>
                <button
                    onClick={() => setTipoVisao("dre")}
                    style={{
                        padding: "10px 18px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontWeight: "600",
                        cursor: "pointer",
                        backgroundColor: tipoVisao === "dre" ? "#35448a" : "#fff",
                        color: tipoVisao === "dre" ? "#fff" : "#475569"
                    }}
                >
                    📈 Movimentações Financeiras (DRE)
                </button>
                <button
                    onClick={() => setTipoVisao("folha")}
                    style={{
                        padding: "10px 18px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontWeight: "600",
                        cursor: "pointer",
                        backgroundColor: tipoVisao === "folha" ? "#35448a" : "#fff",
                        color: tipoVisao === "folha" ? "#fff" : "#475569"
                    }}
                >
                    👥 Folha de Pagamento
                </button>
            </div>
            
            {!loading && !erro && data.length > 0 && (
                <Card title={`🔍 Filtrar - ${configAtual.titulo}`}>
                    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "flex-end" }}>
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

                        <Button 
                            onClick={() => {
                                setBuscaGlobal("");
                                setFiltrosColuna({});
                                setValorMin("");
                                setValorMax("");
                            }}>
                            Limpar Filtros
                        </Button>
                    </div>
                
                    <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", 
                        gap: "12px",
                        paddingTop: "15px"
                    }}>
                        {configAtual.columns
                            .filter(col => !configAtual.colunasSemSelect.includes(col.key))
                            .map((col) => {
                                const opcoesDisponiveis = obterOpcoesUnicasCruzadas(col.key);
                                const listId = `list-filtro-${col.key}`;
                                
                                return (
                                    <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <Inputlist
                                            id={`filtro-coluna-${col.key}`}
                                            label={`${col.label}:`}
                                            placeholder="Filtrar ou buscar..."
                                            value={filtrosColuna[col.key] || ""}
                                            onChange={(e) => handleFiltroColunaChange(col.key, e.target.value)}
                                            options={opcoesDisponiveis}
                                        />
                                    </div>
                                );
                            })
                        }
                    </div>
                </Card>
            )}

            <Card title={`📊 ${configAtual.titulo} — Banco: ${bancoAtivo || "Carregando..."}`}> 
                {loading ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                        <span>🔄 Carregando registros do SQL Server...</span>
                    </div>
                ) : erro ? (
                    <div style={{ 
                        padding: "24px", 
                        textAlign: "center", 
                        color: "#b45309", 
                        backgroundColor: "#fffbeb", 
                        border: "1px solid #fef3c7", 
                        borderRadius: "8px",
                        margin: "10px auto",
                        maxWidth: "600px",
                        lineHeight: "1.5"
                    }}>
                        <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚠️</div>
                        <strong style={{ fontSize: "15px" }}>Nenhum registro encontrado!</strong><br/>
                        Não foi possível carregar a tabela de <b>{configAtual.titulo}</b> no banco <b>{bancoAtivo}</b>.<br/>
                    </div>
                ) : data.length > 0 ? (
                    <div className="table-container">
                        <div style={{ fontSize: "12px", color: "#64748b", textAlign: "right" }}>
                            Exibindo <b>{dadosFiltrados.length}</b> de <b>{data.length}</b> registros.
                        </div>
                        <Table columns={configAtual.columns} data={dadosFiltrados} />
                    </div>
                ) : (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                        Nenhum dado cadastrado para {configAtual.titulo}.
                    </div>
                )}
            </Card>
        </div>
    );
}