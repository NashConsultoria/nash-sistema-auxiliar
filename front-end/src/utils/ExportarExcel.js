import { API_BASE } from "../context/AuthContext";

export const ExportarExcel = async ({ 
    tabela, 
    colunaFiltro, 
    valorFiltro, 
    colunas,
    nomeArquivoCustomizado 
}) => {
    try {
        const token = localStorage.getItem("token");

        let url = `${API_BASE}/api/exportar-excel/${tabela}`;
        const params = new URLSearchParams();
        
        // Filtro de linha
        if (colunaFiltro && valorFiltro) {
            params.append("coluna_filtro", colunaFiltro);
            params.append("valor_filtro", valorFiltro);
        }

        // Filtro de colunas
        if (colunas) {
            const colunasStr = Array.isArray(colunas) ? colunas.join(",") : colunas;
            params.append("colunas", colunasStr);
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const erroData = await response.json();
            throw new Error(erroData.detail || "Erro ao gerar arquivo Excel.");
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = nomeArquivoCustomizado || `Exportacao_${tabela}.xlsx`;
        
        document.body.appendChild(a);
        a.click();
        
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
        console.error("Erro na exportação:", error);
        alert(`Erro ao exportar: ${error.message}`);
    }
};