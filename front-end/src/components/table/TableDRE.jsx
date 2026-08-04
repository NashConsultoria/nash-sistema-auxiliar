import React from "react";
import "./TableDRE.css";

export default function TableDRE({ 
    data = [], 
    expandedRows, 
    onToggleRow, 
    meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"] 
}) {

    const formatarMoeda = (valor) => {
        if (valor === null || valor === undefined) return "-";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(valor);
    };

    if (data.length === 0) {
        return <p className="dre-vazia">Nenhum dado de DRE gerado.</p>;
    }

    return (
        <div className="table-dre-wrapper">
            <table className="table-dre">
                <thead>
                    <tr>
                        <th className="dre-th-main"></th>
                        {meses.map((mes, idx) => (
                            <th key={idx} className="dre-th-mes">{mes}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => {
                        const éCalculo = row.tipo === "calculo";
                        const éGrupoPai = row.level === 1 && !éCalculo;
                        const éSubGrupo = row.level === 2;
                        
                        const temFilhos = row.level < 3 && !éCalculo; 
                        const estaExpandido = expandedRows?.has(row.id);
                        
                        // Define a classe da linha com base no tipo e nível
                        let classeLinha = "dre-row-nivel3";
                        if (éCalculo) classeLinha = "dre-row-calculo";
                        else if (éGrupoPai) classeLinha = "dre-row-pai";
                        else if (éSubGrupo) classeLinha = "dre-row-subgrupo";

                        if (temFilhos) classeLinha += " dre-row-clicavel";

                        return (
                            <tr 
                                key={row.id} 
                                className={classeLinha}
                                onClick={() => temFilhos && onToggleRow && onToggleRow(row.id)}
                            >
                                {/* Coluna da Descrição (com recuo/indentação dinâmico) */}
                                <td className={`dre-td-descricao nivel-${row.level}`}>
                                    {éCalculo ? (
                                        <span className="dre-icon-calculo">(=)</span>
                                    ) : temFilhos ? (
                                        <span className="dre-icon-toggle">
                                            {estaExpandido ? "▼" : "▶"}
                                        </span>
                                    ) : (
                                        <span className="dre-icon-espaco" />
                                    )}
                                    {row.descricao.toUpperCase()}
                                </td>
                                    
                                {/* Colunas dos Meses */}
                                {row.valores.map((valor, idx) => (
                                    <td key={idx} className="dre-td-valor">
                                        {formatarMoeda(valor)}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}