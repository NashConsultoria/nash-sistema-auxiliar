import "./Table.css"; 

export default function Table({ columns = [], data = [], getRowClassName }) {
    // 1. Evita quebrar o layout se nenhuma coluna for fornecida
    if (columns.length === 0) {
        return <p style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>Nenhuma coluna configurada.</p>;
    }

    return (
        <div className="table-wrapper">
            <table className="table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => {
                            // Define a classe de alinhamento de forma limpa
                            const alignClass = col.style?.textAlign === "right" ? "text-right" : 
                                               col.style?.textAlign === "center" ? "text-center" : "text-left";
                            return (
                                <th 
                                    key={col.key || col.id || idx} 
                                    className={alignClass}
                                    style={{ width: col.width }}
                                >
                                    {col.label}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {/* 2. Tratamento para lista vazia aproveitado do componente antigo */}
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                                Nenhum registro encontrado.
                            </td>
                        </tr>
                    ) : (
                        data.map((row, index) => {
                            const customRowClass = getRowClassName ? getRowClassName(row) : "";

                            return (
                                <tr key={row.id || index} className={customRowClass}>
                                    {columns.map((col, colIdx) => {
                                        const value = row[col.key];
                                        const alignClass = col.style?.textAlign === "right" ? "text-right" : 
                                                           col.style?.textAlign === "center" ? "text-center" : "text-left";
                                        return (
                                            <td 
                                                key={col.key || col.id || colIdx} 
                                                className={alignClass}
                                            >
                                                {/* Mantém o poderoso recurso de renderização customizada ou fallback de string */}
                                                {col.Cell ? col.Cell({ row, value }) : (value ?? "-")}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}