import React, { useEffect, useState, useMemo } from "react";
import Card from "../components/card/Card";
import TableDRE from "../components/table/TableDRE";
import Chart from "../components/chart/Chart";
import FiltroBar from "../components/filtro/FiltroBar";
import Button from "../components/button/Button";
import { useAuth } from "../context/AuthContext";
import { usePrint } from "../context/PrintContext";

export default function FolhaPagamentoPage() {
    const { usuario, token } = useAuth();

    const [dadosFolha, setDadosFolha] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState(null);

    const [contratantes, setContratantes] = useState([]);
    const [unidades, setUnidades] = useState([]);

    const [contratanteSel, setContratanteSel] = useState("");
    const [unidadeSel, setUnidadeSel] = useState("");

    // 1. Data Início e Fim
    const [dataInicio, setDataInicio] = useState(() => {
        const anoAtual = new Date().getFullYear();
        return `${anoAtual}-01-01`;
    });

    const [dataFim, setDataFim] = useState(() => {
        const anoAtual = new Date().getFullYear();
        return `${anoAtual}-12-31`;
    });

    // 2. Controle unificado de expansão de linhas
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [expandido, setExpandido] = useState(false);

    const toggleRow = (id) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const [requisicaoContratantesConcluida, setRequisicaoContratantesConcluida] = useState(false);

    // ==================================================================
    // 1. CARREGA OS CONTRATANTES
    // ==================================================================
    useEffect(() => {
        if (!token || !usuario || !usuario.id) return;

        if (usuario.perfil === 3) {
            const nomePadrao = usuario.nome_contratante || "Minha Empresa";
            setContratantes([{ id: usuario.contratanteId, nome: nomePadrao }]);
            setContratanteSel(nomePadrao);
            setRequisicaoContratantesConcluida(true);
            return;
        }

        let url = "http://127.0.0.1:8000/api/NashBancoConsultoria/dados/Contratante";

        if (usuario.perfil === 2 && Number(usuario.protegido) !== 1) {
            url = `http://127.0.0.1:8000/api/usuarios/${usuario.id}/contratantes`;
        }

        fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Erro ${res.status} ao buscar contratantes`);
                return res.json();
            })
            .then((data) => {
                const listaTratada = Array.isArray(data) ? data : [];
                const listaNormalizada = listaTratada.map((item) => {
                    if (item?.contratante) return { id: item.contratante.id, nome: item.contratante.nome };
                    if (item?.contratanteId && !item.nome) return { id: item.contratanteId, nome: item.nome_contratante || `Contratante ${item.contratanteId}` };
                    return { id: item?.id, nome: item?.nome };
                }).filter(item => item && item.nome);

                setContratantes(listaNormalizada);

                if (usuario.perfil === 2 && Number(usuario.protegido) !== 1) {
                    setContratanteSel(listaNormalizada.length === 1 ? listaNormalizada[0].nome : "");
                }
            })
            .catch((err) => console.error("Erro ao buscar contratantes:", err))
            .finally(() => setRequisicaoContratantesConcluida(true));
    }, [token, usuario]);

    // ==================================================================
    // 2. FILTRO EM CASCATA: UNIDADES
    // ==================================================================
    useEffect(() => {
        if (!contratanteSel || !token) {
            setUnidades([]);
            setUnidadeSel("");
            return;
        }

        fetch("http://127.0.0.1:8000/api/NashBancoConsultoria/dados/Unidade", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Erro ${res.status} ao buscar unidades`);
                return res.json();
            })
            .then((data) => {
                const contratanteId = contratantes.find((c) => c.nome === contratanteSel)?.id;
                const filtradas = (data || []).filter((u) => u.contratanteId === contratanteId);
                setUnidades(filtradas);
                setUnidadeSel("");
            })
            .catch((err) => console.error("Erro ao buscar unidades:", err));
    }, [contratanteSel, contratantes, token]);

    // ==================================================================
    // 3. BUSCA DADOS DA FOLHA DE PAGAMENTO (AJUSTADO PARA UTILIZAR DATA INÍCIO / FIM)
    // ==================================================================
    useEffect(() => {
        if (!token || !usuario || !usuario.id || !requisicaoContratantesConcluida) return;

        const ehAdminOuSupremo = usuario.perfil === 1 || Number(usuario.protegido) === 1;

        if (!ehAdminOuSupremo && contratantes.length === 0) {
            setDadosFolha([]);
            setCarregando(false);
            return;
        }

        setCarregando(true);
        setErro(null);

        let url = `http://127.0.0.1:8000/api/NashBancoConsultoria/relatorio-folha-pagamento?data_inicio=${dataInicio}&data_fim=${dataFim}`;

        if (contratanteSel) {
            url += `&contratante=${encodeURIComponent(contratanteSel)}`;
        } else if (!ehAdminOuSupremo && contratantes.length > 0) {
            const nomesVinculados = contratantes.map(c => c.nome);
            url += `&contratante=${encodeURIComponent(nomesVinculados.join(","))}`;
        }

        if (unidadeSel) {
            url += `&unidade=${encodeURIComponent(unidadeSel)}`;
        }

        fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Erro ${res.status} ao buscar a Folha de Pagamento`);
                return res.json();
            })
            .then((apiData) => {
                setDadosFolha(apiData.folha || []);
                setCarregando(false);
            })
            .catch((err) => {
                console.error("Erro ao buscar dados da Folha de Pagamento:", err);
                setDadosFolha([]); 
                setErro(err.message);
                setCarregando(false);
            });
    }, [token, usuario, requisicaoContratantesConcluida, contratantes, contratanteSel, unidadeSel, dataInicio, dataFim]);

    // ==================================================================
    // CONTEXTO DE IMPRESSÃO
    // ==================================================================
    const { setPrintData } = usePrint();

    useEffect(() => {
        setPrintData({
            titulo: "Demonstrativo da Folha de Pagamento",
            detalhes: [
                `Contratante: ${contratanteSel || "Todos"}`,
                `Unidade: ${unidadeSel || "Todas"}`,
                `Período: ${dataInicio} até ${dataFim}`
            ]
        });
    }, [contratanteSel, unidadeSel, dataInicio, dataFim]);

    // ==================================================================
    // 4. PROCESSAMENTO DA ÁRVORE (ATÉ 4 NÍVEIS)
    // ==================================================================
    const dadosAchatados = useMemo(() => {
        if (!dadosFolha || !Array.isArray(dadosFolha) || dadosFolha.length === 0) return [];

        const lista = [];

        dadosFolha.forEach((n1, indexN1) => {
            // Ignora apenas o 'NAO APLICA'
            if (n1.nome && n1.nome.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("NAO APLICA")) {
                return; 
            }

            const idN1 = `n1-${indexN1}-${n1.nome}`;
            lista.push({
                id: idN1,
                descricao: n1.nome,
                level: 1,
                tipo: "grupo",
                valores: n1.valores || new Array(12).fill(0),
                parentId: null
            });

            const subgrupos = n1.grupos_contas || n1.contas || [];
            subgrupos.forEach((n2, indexN2) => {
                const idN2 = `n2-${indexN1}-${indexN2}-${n2.nome}`;
                lista.push({
                    id: idN2,
                    descricao: n2.nome,
                    level: 2,
                    tipo: "subgrupo",
                    valores: n2.valores || new Array(12).fill(0),
                    parentId: idN1
                });

                const planos = n2.contas || n2.grupos_contas || [];
                planos.forEach((n3, indexN3) => {
                    const idN3 = `n3-${indexN1}-${indexN2}-${indexN3}-${n3.nome}`;
                    lista.push({
                        id: idN3,
                        descricao: n3.nome,
                        level: 3,
                        tipo: "subgrupo",
                        valores: n3.valores || new Array(12).fill(0),
                        parentId: idN2
                    });

                    const pessoas = n3.contas || n3.nomes || n3.grupos_contas || [];
                    pessoas.forEach((n4, indexN4) => {
                        const idN4 = `n4-${indexN1}-${indexN2}-${indexN3}-${indexN4}-${n4.nome}`;
                        lista.push({
                            id: idN4,
                            descricao: n4.nome,
                            level: 4,
                            tipo: "conta_folha",
                            valores: n4.valores || new Array(12).fill(0),
                            parentId: idN3
                        });
                    });
                });
            });
        });

        return lista;
    }, [dadosFolha]);

    const handleToggleExpandirTudo = () => {
        if (expandido) {
            setExpandedRows(new Set());
            setExpandido(false);
        } else {
            const idsPais = dadosAchatados
                .filter((item) => item.level === 1 || item.level === 2 || item.level === 3)
                .map((item) => item.id);
            setExpandedRows(new Set(idsPais));
            setExpandido(true);
        }
    };

    const mesesBase = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // Cálculo dinâmico dos meses contidos nas datas do filtro
    const mesesAtivosIdx = useMemo(() => {
        if (!dataInicio || !dataFim) return Array.from({ length: 12 }, (_, i) => i);

        const mesInicio = parseInt(dataInicio.split("-")[1], 10) - 1;
        const mesFim = parseInt(dataFim.split("-")[1], 10) - 1;

        const indices = [];
        if (mesInicio <= mesFim) {
            for (let i = mesInicio; i <= mesFim; i++) indices.push(i);
        } else {
            for (let i = mesInicio; i < 12; i++) indices.push(i);
            for (let i = 0; i <= mesFim; i++) indices.push(i);
        }

        return indices;
    }, [dataInicio, dataFim]);

    const mesesFiltrados = useMemo(() => mesesAtivosIdx.map((i) => mesesBase[i]), [mesesAtivosIdx]);

    const filtrarMesesDosDados = (linhas) =>
        linhas.map((linha) => ({
            ...linha,
            valores: mesesAtivosIdx.map((i) => linha.valores[i]),
        }));

    const dadosComMetricasFiltrados = useMemo(() => {
        const linhasNivel1 = dadosAchatados.filter((r) => r.level === 1);

        const linhaProventos = linhasNivel1.find((r) => r.descricao.toUpperCase().includes("PROVENTO"));
        const linhaDescontos = linhasNivel1.find((r) => r.descricao.toUpperCase().includes("DESCONTO"));

        const valoresProventos = linhaProventos ? linhaProventos.valores : new Array(12).fill(0);
        const valoresDescontos = linhaDescontos ? linhaDescontos.valores : new Array(12).fill(0);

        const rawData = [
            ...dadosAchatados,
            { id: "chart-proventos", descricao: "Proventos", level: 0, type: "metric", valores: valoresProventos },
            { id: "chart-descontos", descricao: "Descontos", level: 0, type: "metric", valores: valoresDescontos },
        ];

        return filtrarMesesDosDados(rawData);
    }, [dadosAchatados, mesesAtivosIdx]);

    const linhasParaRenderizar = useMemo(() => {
        const linhasVisiveis = [];

        dadosAchatados.forEach((linha) => {
            if (linha.level === 1) {
                linhasVisiveis.push(linha);
            } else if (linha.level === 2) {
                if (expandedRows.has(linha.parentId)) {
                    linhasVisiveis.push(linha);
                }
            } else if (linha.level === 3) {
                const n2Obj = dadosAchatados.find(x => x.id === linha.parentId);
                if (n2Obj && expandedRows.has(n2Obj.parentId) && expandedRows.has(n2Obj.id)) {
                    linhasVisiveis.push(linha);
                }
            } else if (linha.level === 4) {
                const n3Obj = dadosAchatados.find(x => x.id === linha.parentId);
                const n2Obj = n3Obj ? dadosAchatados.find(x => x.id === n3Obj.parentId) : null;
                if (n3Obj && n2Obj && expandedRows.has(n2Obj.parentId) && expandedRows.has(n2Obj.id) && expandedRows.has(n3Obj.id)) {
                    linhasVisiveis.push(linha);
                }
            }
        });

        return filtrarMesesDosDados(linhasVisiveis);
    }, [dadosAchatados, expandedRows, mesesAtivosIdx]);

    return (
        <div className="page-container">
            {/* BARRA DE FILTROS PADRONIZADA */}
            <FiltroBar
                contratanteSel={contratanteSel}
                setContratanteSel={setContratanteSel}
                contratantes={contratantes}
                unidadeSel={unidadeSel}
                setUnidadeSel={setUnidadeSel}
                unidades={unidades}
                dataInicio={dataInicio}
                setDataInicio={setDataInicio}
                dataFim={dataFim}
                setDataFim={setDataFim}
                desabilitarContratante={usuario?.perfil === 3}
                datalistSuffix="folha"
                acoesAdicionais={
                    <>
                        <Button onClick={handleToggleExpandirTudo}>
                            {expandido ? "Recolher Tudo" : "Expandir Tudo"}
                        </Button>

                        <Button onClick={() => window.print()}>
                            Imprimir
                        </Button>
                    </>
                }
            />

            {erro && (
                <div style={{
                    marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
                    backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "13px"
                }}>
                    {erro}
                </div>
            )}

            <Card title="Folha de Pagamento - Demonstrativo Mensal">
                {carregando ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>Atualizando tabela...</div>
                ) : (
                    <TableDRE
                        tituloColuna="FOLHA DE PAGAMENTO"
                        data={linhasParaRenderizar}
                        meses={mesesFiltrados}
                        expandedRows={expandedRows}
                        onToggleRow={toggleRow}
                    />
                )}
            </Card>

            <div className="dashboard-grid">
                <div className="chart-card">
                    <Chart
                        title="Análise de Proventos vs Descontos"
                        meses={mesesFiltrados}
                        data={dadosComMetricasFiltrados}
                        series={[
                            { descricao: "Proventos", type: "bar", color: "#35448a" },
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}