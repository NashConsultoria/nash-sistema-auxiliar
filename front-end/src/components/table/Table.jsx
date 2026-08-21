import "./Table.css"; 

export default function Table({ columns = [], data = [], getRowClassName }) {
    if (columns.length === 0) {
        return <p style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>Nenhuma coluna configurada.</p>;
    }

    return (
        <div className="table-wrapper">
            <table className="table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => {
                            const alignClass = col.style?.textAlign === "right" ? "text-right" : 
                                               col.style?.textAlign === "center" ? "text-center" : "text-left";
                            
                            // Se a coluna for sticky, garante background apropriado para o cabeçalho
                            const isSticky = col.style?.position === "sticky";

                            const headerStyle = {
                                width: col.width,
                                ...col.style,
                                ...(isSticky ? { 
                                    position: "sticky",
                                    top: 0,                           // Garante a fixação vertical no topo
                                    right: 0,                         // Garante a fixação horizontal à direita
                                    backgroundColor: "var(--bg-color1)", // Mantém o fundo azul do cabeçalho
                                    zIndex: 3                         // Fica acima das células da tabela (que usam zIndex: 2)
                                } : {})
                            };

                            return (
                                <th 
                                    key={col.key || col.id || idx} 
                                    className={alignClass}
                                    style={headerStyle}
                                >
                                    {col.label}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
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
                                        
                                        // Se a coluna for sticky, herda a cor exata da linha atual (preserva zebrado e hover)
                                        const isSticky = col.style?.position === "sticky";
                                        const cellStyle = {
                                            ...col.style,
                                            ...(isSticky ? { backgroundColor: "inherit" } : {})
                                        };

                                        return (
                                            <td 
                                                key={col.key || col.id || colIdx} 
                                                className={alignClass}
                                                style={cellStyle}
                                            >
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