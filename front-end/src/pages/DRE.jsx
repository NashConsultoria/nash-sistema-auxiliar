import React, { useEffect, useState, useMemo } from "react";
import "../styles/print.css";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import TableDRE from "../components/table/TableDRE";
import Chart from "../components/chart/Chart";
import FiltroBar from "../components/filtro/FiltroBar";
import { useAuth } from "../context/AuthContext";
import { usePrint } from "../context/PrintContext";

export default function DRE() {
    const { usuario, token } = useAuth();

    const [dadosDRE, setDadosDRE] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState(null);

    const [contratantes, setContratantes] = useState([]);
    const [contratanteSel, setContratanteSel] = useState("");

    const [unidades, setUnidades] = useState([]);
    const [unidadeSel, setUnidadeSel] = useState([]);

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
    // 2. FILTRO EM CASCATA: CARREGA AS UNIDADES DO CONTRATANTE
    // ==================================================================
    useEffect(() => {
        if (!contratanteSel || !token) {
            setUnidades([]);
            setUnidadeSel([]);
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
            })
            .catch((err) => console.error("Erro ao buscar unidades:", err));
    }, [contratanteSel, token, contratantes]); 

    useEffect(() => {
        setUnidadeSel([]);
    }, [contratanteSel]);

    // 2.1 FILTRAGEM DINÂMICA DAS UNIDADES (Oculta unidades sem movimento)
    const unidadesExibidas = useMemo(() => {
        if (!dadosDRE || !Array.isArray(dadosDRE) || dadosDRE.length === 0) {
            return unidades;
        }

        const unidadesComValoresSet = new Set();

        const possuiMovimento = (valores) => {
            return Array.isArray(valores) && valores.some((v) => v !== 0 && v !== null && v !== undefined);
        };

        dadosDRE.forEach((n1) => {
            if (n1.unidade && possuiMovimento(n1.valores)) {
                unidadesComValoresSet.add(n1.unidade.trim().toUpperCase());
            }

            n1.grupos_contas?.forEach((n2) => {
                if (n2.unidade && possuiMovimento(n2.valores)) {
                    unidadesComValoresSet.add(n2.unidade.trim().toUpperCase());
                }

                n2.contas?.forEach((n3) => {
                    if (n3.unidade && possuiMovimento(n3.valores)) {
                        unidadesComValoresSet.add(n3.unidade.trim().toUpperCase());
                    }
                });
            });
        });

        if (unidadesComValoresSet.size > 0) {
            return unidades.filter((u) => 
                u.nome && unidadesComValoresSet.has(u.nome.trim().toUpperCase())
            );
        }

        return unidades;
    }, [unidades, dadosDRE]);

    // ==================================================================
    // GERAÇÃO DINÂMICA DE MESES / ANOS A PARTIR DO PERÍODO SELECIONADO
    // ==================================================================
    const mesesColunas = useMemo(() => {
        if (!dataInicio || !dataFim) return [];

        const anoInicio = parseInt(dataInicio.split("-")[0], 10);
        const anoFim = parseInt(dataFim.split("-")[0], 10);

        // Evita calcular colunas para datas incompletas/inválidas
        if (isNaN(anoInicio) || anoInicio < 1900 || isNaN(anoFim) || anoFim < 1900) {
            return [];
        }

        const inicio = new Date(dataInicio + "T00:00:00");
        const fim = new Date(dataFim + "T00:00:00");

        // Trava para evitar loops infinitos se a data inicial for maior que a final por engano
        if (inicio > fim) return [];

        const resultado = [];
        const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        let atual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
        const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);

        while (atual <= limite) {
            const mesNome = nomesMeses[atual.getMonth()];
            const anoCurto = atual.getFullYear().toString().slice(-2);
            
            resultado.push({
                label: `${mesNome}/${anoCurto}`,
                ano: atual.getFullYear(),
                mes: atual.getMonth() + 1
            });

            atual.setMonth(atual.getMonth() + 1);
        }

        return resultado;
    }, [dataInicio, dataFim]);

    // Labels formatados para o cabeçalho (ex: ["Jan/25", "Fev/25", ...])
    const mesesLabels = useMemo(() => mesesColunas.map(m => m.label), [mesesColunas]);

    // ==================================================================
    // 3. RECARREGA OS DADOS DA DRE
    // ==================================================================
    useEffect(() => {
        if (!token || !usuario || !usuario.id || !requisicaoContratantesConcluida) return;

        // --- TRAVA DE SEGURANÇA CONTRA ANOS INCOMPLETOS ---
        const anoInicio = parseInt(dataInicio.split("-")[0], 10);
        const anoFim = parseInt(dataFim.split("-")[0], 10);

        // Só dispara se os anos tiverem 4 dígitos válidos (ex: entre 1900 e 2099)
        if (isNaN(anoInicio) || anoInicio < 1900 || isNaN(anoFim) || anoFim < 1900) {
            return; 
        }

        const ehAdminOuSupremo = usuario.perfil === 1 || Number(usuario.protegido) === 1;

        if (!ehAdminOuSupremo && contratantes.length === 0) {
            setDadosDRE([]);
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

        if (Array.isArray(unidadeSel) && unidadeSel.length > 0) {
            const unidadesFormatadas = unidadeSel.map(u => encodeURIComponent(u)).join(",");
            url += `&unidade=${unidadesFormatadas}&unidades=${unidadesFormatadas}`;
        }

        fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Erro ${res.status} ao buscar a DRE`);
                return res.json();
            })
            .then((apiData) => {
                setDadosDRE(apiData.dre || []);
                setCarregando(false);
            })
            .catch((err) => {
                console.error("Erro ao buscar dados da DRE:", err);
                setDadosDRE([]); 
                setErro(err.message);
                setCarregando(false);
            });
    }, [token, usuario, requisicaoContratantesConcluida, contratantes, contratanteSel, unidadeSel, dataInicio, dataFim]);

    const { setPrintData } = usePrint();
    
    useEffect(() => {
        const textoUnidade = 
            !Array.isArray(unidadeSel) || unidadeSel.length === 0 
                ? "Todas" 
                : unidadeSel.join(", ");

        setPrintData({
            titulo: "Demonstração do Resultado do Exercício (DRE)",
            detalhes: [
                `Contratante: ${contratanteSel || "Todos"}`,
                `Unidade: ${textoUnidade}`,
                `Período: ${dataInicio} até ${dataFim}`
            ]
        });
    }, [contratanteSel, unidadeSel, dataInicio, dataFim]);

    // ==================================================================
    // PROCESSAMENTO E ACHATAMENTO DA ÁRVORE (3 NÍVEIS)
    // ==================================================================
    const dadosAchatados = useMemo(() => {
        if (!dadosDRE || !Array.isArray(dadosDRE)) return [];

        // Função para recortar/filtrar os valores com base no tamanho do intervalo filtrado
        const adequarValores = (valoresOriginais) => {
            if (!Array.isArray(valoresOriginais)) {
                return new Array(mesesColunas.length).fill(0);
            }

            // Se a API envia 12 meses fixos (Jan..Dez do ano), recortamos do mês inicial ao final do filtro
            if (valoresOriginais.length === 12 && mesesColunas.length <= 12) {
                const mesInicialIdx = mesesColunas.length > 0 ? mesesColunas[0].mes - 1 : 0;
                const mesFinalIdx = mesInicialIdx + mesesColunas.length;
                return valoresOriginais.slice(mesInicialIdx, mesFinalIdx);
            }

            // Se a API já enviar do tamanho exato ou maior
            return valoresOriginais.slice(0, mesesColunas.length);
        };

        const lista = [];

        dadosDRE.forEach((n1) => {
            const idN1 = `n1-${n1.nome}`;
            lista.push({
                id: idN1,
                descricao: n1.nome,
                level: 1,
                tipo: n1.tipo || "grupo",
                valores: adequarValores(n1.valores), 
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
                        valores: adequarValores(n2.valores),
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
                                valores: adequarValores(n3.valores),
                                parentId: idN2
                            });
                        });
                    }
                });
            }
        });

        return lista;
    }, [dadosDRE, mesesColunas]);

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

    const dadosComMetricasFiltrados = useMemo(() => {
        const totalColunas = mesesColunas.length || 12;
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

        const valoresReceitaBruta = linhaReceitaBruta ? linhaReceitaBruta.valores : new Array(totalColunas).fill(0);
        const valoresResultadoOperacional = linhaResultadoOperacional ? linhaResultadoOperacional.valores : new Array(totalColunas).fill(0);
        const valoresResultadoFinal = linhaResultadoFinal ? linhaResultadoFinal.valores : new Array(totalColunas).fill(0);

        return [
            ...dadosAchatados,
            { id: "chart-receita-bruta", descricao: "Receita Bruta", level: 0, type: "metric", valores: valoresReceitaBruta },
            { id: "chart-res-operacional", descricao: "Resultado Operacional", level: 0, type: "metric", valores: valoresResultadoOperacional },
            { id: "chart-res-final", descricao: "Resultado Final", level: 0, type: "metric", valores: valoresResultadoFinal },
        ];
    }, [dadosAchatados, mesesColunas]);

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

        return linhasVisiveis;
    }, [dadosAchatados, expandedRows]);

    return (
        <div className="page-container">
            {/* BARRA DE FILTROS E AÇÕES */}
            <FiltroBar
                contratanteSel={contratanteSel}
                setContratanteSel={setContratanteSel}
                contratantes={contratantes}
                unidadeSel={unidadeSel}
                setUnidadeSel={setUnidadeSel}
                unidades={unidadesExibidas}
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

            <Card title="DRE - Demonstração de Resultado">
                {carregando ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>Atualizando tabela...</div>
                ) : (
                    <TableDRE
                        data={linhasParaRenderizar}
                        meses={mesesLabels}
                        expandedRows={expandedRows}
                        onToggleRow={toggleRow}
                    />
                )}
            </Card>

            <div className="dashboard-grid">
                <div className="chart-card">
                    <Chart
                        title="Análise de Resultado"
                        meses={mesesLabels}
                        data={dadosComMetricasFiltrados}
                        series={[
                            { descricao: "Resultado Operacional", type: "line", color: "var(--bg-color7)" },
                            { descricao: "Resultado Final", type: "line", color: "var(--bg-color1)" }
                        ]}
                    />
                </div>
                
                <div className="chart-card">
                    <Chart
                        title="Receita x Resultado Operacional"
                        meses={mesesLabels}
                        data={dadosComMetricasFiltrados}
                        series={[
                            { descricao: "Receita Bruta", type: "bar", color: "var(--bg-color1)" },
                            { descricao: "Resultado Operacional", type: "line", color: "var(--bg-color7)" }
                        ]}
                    />
                </div>
            </div>
        </div>
    );
}