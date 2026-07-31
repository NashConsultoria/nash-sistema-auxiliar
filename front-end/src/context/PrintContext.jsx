import React, { createContext, useContext, useState } from "react";

const PrintContext = createContext();

export function PrintProvider({ children }) {
    const [printData, setPrintData] = useState({
        titulo: "Relatório Financeiro",
        detalhes: [] // Ex: ["Contratante: Empresa X", "Período: 2026"]
    });

    return (
        <PrintContext.Provider value={{ printData, setPrintData }}>
            {children}
        </PrintContext.Provider>
    );
}

export function usePrint() {
    return useContext(PrintContext);
}