import React, { useEffect, useState, useMemo } from "react";
import "../styles/print.css";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import Table from "../components/table/Table";
import Chart from "../components/chart/Chart";
import PieChart from "../components/chart/PieChart";
import FiltroBar from "../components/filtro/FiltroBar";
import { useAuth } from "../context/AuthContext";
import { usePrint } from "../context/PrintContext";

export default function FluxoCaixa() {

    const { usuario, token } = useAuth();

    const [dadosDFC, setDadosDFC] = useState([]);
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
            const contratanteDoCliente = {
                id: usuario.contratanteId,
                nome: nomePadrao
            };
            setContratantes([contratanteDoCliente]);
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
                    if (item && item.contratante) {
                        return { id: item.contratante.id, nome: item.contratante.nome };
                    }
                    if (item && item.contratanteId && !item.nome) {
                        return { id: item.contratanteId, nome: item.nome_contratante || `Contratante ${item.contratanteId}` };
                    }
                    return { id: item?.id, nome: item?.nome };
                }).filter(item => item && item.nome);

                setContratantes(listaNormalizada);

                if (usuario.perfil === 2 && Number(usuario.protegido) !== 1) {
                    if (listaNormalizada.length === 1) {
                        setContratanteSel(listaNormalizada[0].nome);
                    } else {
                        setContratanteSel(""); 
                    }
                }
            })
            .catch((err) => {
                console.error("Erro ao buscar contratantes:", err);
            })
            .finally(() => {
                setRequisicaoContratantesConcluida(true);
            });
    }, [token, usuario]);

    // ==================================================================
    // 2. FILTRO EM CASCATA: CARREGA AS UNIDADES
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
                const filtradas = data.filter((u) => u.contratanteId === contratanteId);
                setUnidades(filtradas);
                setUnidadeSel("");
            })
            .catch((err) => console.error("Erro ao buscar unidades:", err));
    }, [contratanteSel, contratantes, token]);

    // ==================================================================
    // 3. RECARREGA OS DADOS DA DRE
    // ==================================================================
    useEffect(() => {
        if (!token || !usuario || !usuario.id || !requisicaoContratantesConcluida) return;

        const ehAdminOuSupremo = usuario.perfil === 1 || Number(usuario.protegido) === 1;

        if (!ehAdminOuSupremo && contratantes.length === 0) {
            setDadosDFC([]);
            setCarregando(false);
            return;
        }

        setCarregando(true);
        setErro(null);

        let url = `http://127.0.0.1:8000/api/NashBancoConsultoria/dre?data_inicio=${dataInicio}&data_fim=${dataFim}`;

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
                if (!res.ok) throw new Error(`Erro ${res.status} ao buscar a DRE`);
                return res.json();
            })
            .then((apiData) => {
                setDadosDFC(apiData.dre || []);
                setCarregando(false);
            })
            .catch((err) => {
                console.error("Erro ao buscar dados da DRE:", err);
                setDadosDFC([]); 
                setErro(err.message);
                setCarregando(false);
            });
    }, [token, usuario, requisicaoContratantesConcluida, contratantes, contratanteSel, unidadeSel, dataInicio, dataFim]);

    const { setPrintData } = usePrint();
    
    useEffect(() => {
        setPrintData({
            titulo: "Demonstração do Resultado do Exercício (DRE)",
            detalhes: [
                `Contratante: ${contratanteSel || "Todos"}`,
                `Unidade: ${unidadeSel || "Todas"}`,
                `Período: ${dataInicio} até ${dataFim}`
            ]
        });
    }, [contratanteSel, unidadeSel, dataInicio, dataFim]);

    // ==================================================================
    // PROCESSAMENTO E ACHATAMENTO DA ÁRVORE (3 NÍVEIS)
    // ==================================================================
    const dadosAchatados = useMemo(() => {
        if (!dadosDFC || !Array.isArray(dadosDFC)) return [];

        const lista = [];

        dadosDFC.forEach((n1) => {
            const idN1 = `n1-${n1.nome}`;
            lista.push({
                id: idN1,
                descricao: n1.nome,
                level: 1,
                tipo: n1.tipo || "grupo",
                valores: n1.valores || new Array(12).fill(0), 
                parentId: null
            });

            if (n1.grupos_contas && Array.isArray(n1.grupos_contas)) {
                n1.grupos_contas.forEach((n2) => {
                    const idN2 = `n2-${n1.nome}-${n2.nome}`;
                    lista.push({
                        id: idN2,
                        descricao: n2.nome,
                        level: 2,
                        tipo: "subgrupo",
                        valores: n2.valores || new Array(12).fill(0),
                        parentId: idN1
                    });

                    if (n2.contas && Array.isArray(n2.contas)) {
                        n2.contas.forEach((n3) => {
                            const idN3 = `n3-${n1.nome}-${n2.nome}-${n3.nome}`;
                            lista.push({
                                id: idN3,
                                descricao: n3.nome,
                                level: 3,
                                tipo: "conta_folha",
                                valores: n3.valores || new Array(12).fill(0),
                                parentId: idN2
                            });
                        });
                    }
                });
            }
        });

        return lista;
    }, [dadosDFC]);

    const handleToggleExpandirTudo = () => {
        if (expandido) {
            setExpandedRows(new Set());
            setExpandido(false);
        } else {
            const idsPais = dadosAchatados
                .filter((item) => item.level === 1 || item.level === 2)
                .map((item) => item.id);
            setExpandedRows(new Set(idsPais));
            setExpandido(true);
        }
    };

    const mesesBase = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // 2. Detecta quais meses estão contidos no período selecionado (dataInicio até dataFim)
    const mesesAtivosIdx = useMemo(() => {
        if (!dataInicio || !dataFim) return Array.from({ length: 12 }, (_, i) => i);

        // Converte YYYY-MM-DD para índices de mês (0=Jan, 11=Dez)
        const mesInicio = parseInt(dataInicio.split("-")[1], 10) - 1;
        const mesFim = parseInt(dataFim.split("-")[1], 10) - 1;

        const indices = [];
        if (mesInicio <= mesFim) {
            for (let i = mesInicio; i <= mesFim; i++) indices.push(i);
        } else {
            // Se virar o ano (ex: Nov a Mar)
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

        const linhaReceitaBruta = linhasNivel1.find(
            (r) => r.descricao.toUpperCase() === "RECEITA OPERACIONAL BRUTA" || r.descricao.toUpperCase() === "RECEITA OPERACIONAL"
        );
        const linhaResultadoOperacional = linhasNivel1.find(
            (r) => r.descricao.toUpperCase() === "RESULTADO OPERACIONAL"
        );
        const linhaResultadoFinal = linhasNivel1.find(
            (r) => r.descricao.toUpperCase() === "RESULTADO FINAL"
        );

        const valoresReceitaBruta = linhaReceitaBruta ? linhaReceitaBruta.valores : new Array(12).fill(0);
        const valoresResultadoOperacional = linhaResultadoOperacional ? linhaResultadoOperacional.valores : new Array(12).fill(0);
        const valoresResultadoFinal = linhaResultadoFinal ? linhaResultadoFinal.valores : new Array(12).fill(0);

        const rawData = [
            ...dadosAchatados,
            { id: "chart-receita-bruta", descricao: "Receita Bruta", level: 0, type: "metric", valores: valoresReceitaBruta },
            { id: "chart-res-operacional", descricao: "Resultado Operacional", level: 0, type: "metric", valores: valoresResultadoOperacional },
            { id: "chart-res-final", descricao: "Resultado Final", level: 0, type: "metric", valores: valoresResultadoFinal },
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
                const n2Id = linha.parentId;
                const n2Obj = dadosAchatados.find(x => x.id === n2Id);
                const n1Id = n2Obj ? n2Obj.parentId : null;

                if (expandedRows.has(n1Id) && expandedRows.has(n2Id)) {
                    linhasVisiveis.push(linha);
                }
            }
        });

        return filtrarMesesDosDados(linhasVisiveis);
    }, [dadosAchatados, expandedRows, mesesAtivosIdx]);

    const colunas = [
        { label: "Data", key: "data" },
        { label: "Descrição", key: "descricao" },
        { label: "Categoria", key: "categoria" },
        { label: "Valor", key: "valor", align: "right" },
    ];

    const dados = [
        { data: "10/07/2026", descricao: "Assinatura Software", categoria: "Serviços", valor: "R$ 150,00" },
        { data: "12/07/2026", descricao: "Consultoria Financeira", categoria: "Receita", valor: "R$ 4.500,00" },
        { data: "15/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "17/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "20/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "23/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "26/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
    ];

    const distribuicaoCustos = [
        { categoria: "Marketing", custo: 5000, color: "#1e2942" },
        { categoria: "Infraestrutura", custo: 8500, color: "#3b82f6" },
        { categoria: "Pessoal", custo: 12000, color: "#22c55e" },
        { categoria: "Impostos", custo: 3200, color: "#ef4444" },
    ];
    
    return (
        <div className="page-container">
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
                datalistSuffix="dre"
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

            <Card title="Fluxo de Caixa">
                <Table columns={colunas} data={dados} />
            </Card>

            <div className="dashboard-grid">
                <Chart 
                    title="Análise de Lucratividade"
                    meses={colunas}
                    data={dados}
                    series={[
                        { descricao: "EBITDA", type: "line", color: "#FF6200" },
                        { descricao: "Lucro Liquido", type: "line", color: "#3b82f6" }
                    ]}
                />
                <PieChart
                    title="Teste"
                    data={distribuicaoCustos}
                    nameKey="categoria"
                    dataKey="custo"
                    isDonut={false}
                />
            </div>
        </div>
    );
}