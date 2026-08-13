import React, { useState, useMemo } from "react";
import { FaChevronRight, FaChevronDown, FaPlusSquare, FaMinusSquare } from "react-icons/fa";
import "./TableProjetado.css";

// Formata valores numéricos para moeda corrente (BRL)
const formatarMoeda = (valor) => {
    if (valor === null || valor === undefined || isNaN(valor)) return "R$ 0,00";
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

export default function TableProjetado({ dados = [], anoInicial = 2026, quantidadeAnos = 5 }) {
    // 1. Estado para controlar quais Anos estão expandidos (ex: { 1: true, 2: false })
    const [anosExpandidos, setAnosExpandidos] = useState({});

    // 2. Estado para controlar a expansão das linhas hierárquicas (Árvore de contas)
    const [linhasAbertas, setLinhasAbertas] = useState({});

    const toggleAno = (anoNum) => {
        setAnosExpandidos((prev) => ({
            ...prev,
            [anoNum]: !prev[anoNum],
        }));
    };

    const toggleLinha = (idLinha) => {
        setLinhasAbertas((prev) => ({
            ...prev,
            [idLinha]: !prev[idLinha],
        }));
    };

    // 3. Montagem do Cabeçalho Dinâmico
    const estruturaColunas = useMemo(() => {
        const colunas = [];
        const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        for (let i = 0; i < quantidadeAnos; i++) {
            const anoNum = i + 1;
            const anoReal = anoInicial + i;
            const estaExpandido = !!anosExpandidos[anoNum];

            if (estaExpandido) {
                // Se expandido, adiciona os 12 meses
                for (let m = 0; m < 12; m++) {
                    colunas.push({
                        id: `ano${anoNum}-m${m + 1}`,
                        label: `${nomesMeses[m]}/${anoReal.toString().slice(-2)}`,
                        anoNum,
                        idxAbsoluto: i * 12 + m,
                        ehMes: true,
                    });
                }
            }

            // Sempre exibe a coluna Consolidada do Ano (Total)
            colunas.push({
                id: `ano${anoNum}-total`,
                label: `ANO ${anoNum} (${anoReal})`,
                anoNum,
                inicioIdx: i * 12,
                fimIdx: i * 12 + 12,
                ehTotalAno: true,
                estaExpandido,
            });
        }

        return colunas;
    }, [anosExpandidos, anoInicial, quantidadeAnos]);

    return (
        <div className="table-projetado-wrapper">
            <table className="table-projetado">
                {/* --- CABEÇALHO --- */}
                <thead>
                    {/* Linha 1: Controles de Expansão por Ano */}
                    <tr className="header-anos">
                        <th className="th-descricao-header">DRE PROJETADA</th>
                        {Array.from({ length: quantidadeAnos }).map((_, i) => {
                            const anoNum = i + 1;
                            const estaExpandido = !!anosExpandidos[anoNum];
                            const spanCount = estaExpandido ? 13 : 1; // 12 meses + 1 total

                            return (
                                <th key={`ano-header-${anoNum}`} colSpan={spanCount} className="th-grupo-ano">
                                    <button 
                                        type="button" 
                                        className="btn-expandir-ano"
                                        onClick={() => toggleAno(anoNum)}
                                    >
                                        {estaExpandido ? <FaMinusSquare /> : <FaPlusSquare />}
                                        <span>ANO {anoNum} ({anoInicial + i})</span>
                                    </button>
                                </th>
                            );
                        })}
                    </tr>

                    {/* Linha 2: Colunas Individuais (Meses e Totais) */}
                    <tr className="header-colunas">
                        <th className="th-descricao">CONTA / ESTRUTURA</th>
                        {estruturaColunas.map((col) => (
                            <th 
                                key={col.id} 
                                className={`th-coluna ${col.ehTotalAno ? "col-total-ano" : "col-mes"}`}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* --- CORPO DA TABELA --- */}
                <tbody>
                    {dados.map((linha) => {
                        const temFilhos = linha.filhos && linha.filhos.length > 0;
                        const estaAberta = !!linhasAbertas[linha.id];
                        const ehCalculo = linha.tipo === "calculo";

                        return (
                            <tr 
                                key={linha.id} 
                                className={`row-nivel-${linha.level || 1} ${ehCalculo ? "row-calculo" : ""}`}
                            >
                                {/* Célula da Descrição com Indentação */}
                                <td className="td-descricao" style={{ paddingLeft: `${(linha.level || 1) * 16}px` }}>
                                    {temFilhos && (
                                        <button 
                                            type="button" 
                                            className="btn-toggle-row"
                                            onClick={() => toggleLinha(linha.id)}
                                        >
                                            {estaAberta ? <FaChevronDown /> : <FaChevronRight />}
                                        </button>
                                    )}
                                    <span>{linha.descricao}</span>
                                </td>

                                {/* Células de Valores */}
                                {estruturaColunas.map((col) => {
                                    let valorExibido = 0;

                                    if (col.ehMes) {
                                        // Pega o valor exato do mês (de 0 a 59)
                                        valorExibido = linha.valores ? linha.valores[col.idxAbsoluto] : 0;
                                    } else if (col.ehTotalAno) {
                                        // Soma os 12 meses do ano correspondente
                                        if (linha.valores && Array.isArray(linha.valores)) {
                                            const fatiaAno = linha.valores.slice(col.inicioIdx, col.fimIdx);
                                            valorExibido = fatiaAno.reduce((acc, curr) => acc + (curr || 0), 0);
                                        }
                                    }

                                    return (
                                        <td 
                                            key={`${linha.id}-${col.id}`} 
                                            className={`td-valor ${col.ehTotalAno ? "td-total-ano" : "td-mes"} ${valorExibido < 0 ? "valor-negativo" : ""}`}
                                        >
                                            {formatarMoeda(valorExibido)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}