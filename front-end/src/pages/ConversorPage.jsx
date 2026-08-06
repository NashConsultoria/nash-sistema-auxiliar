import { useState, useEffect } from "react";
import Table from "../components/table/Table";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import { useAuth } from "../context/AuthContext";
import "../styles/global.css";

export default function ConversorPage() {
  const { token, selectedDb } = useAuth(); // Assume o uso do banco selecionado no contexto
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileSelected, setFileSelected] = useState(null);

  const API_URL = "http://127.0.0.1:8000/api";

  const columns = [
    { key: "banco", label: "Banco" },
    { key: "agencia", label: "Agência" },
    { key: "conta", label: "Conta" },
    { key: "data", label: "Data" },
    { key: "descricao", label: "Descrição" },
    { key: "valor", label: "Valor" },
    { key: "tipo", label: "Tipo" },
    { key: "fornecedor", label: "Fornecedor" },
  ];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileSelected(file);
      // Aqui você poderá chamar a função de preview do back-end futuramente
    }
  };

  const handleExport = () => {
    if (!data.length) return;
    // Lógica futura para acionar o download/exportação
  };

  return (
    <div className="import-container">
      {/* COLUNA DA ESQUERDA: BARRA LATERAL */}
      <aside className="import-sidebar">
        <Card title="Ações">
          <div className="database-selector-box" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Input de arquivo escondido acionado pelo botão */}
            <input
              type="file"
              id="file-upload"
              style={{ display: "none" }}
              onChange={handleFileChange}
              accept=".ofx"
            />
            
            <Button onClick={() => document.getElementById("file-upload").click()}>
              {fileSelected ? "Trocar Arquivo" : "Importar Arquivo"}
            </Button>

            {fileSelected && (
              <span style={{ fontSize: "12px", color: "var(--text-color1)", wordBreak: "break-all" }}>
                📄 {fileSelected.name}
              </span>
            )}

            <Button 
              onClick={handleExport} 
              disabled={!data || data.length === 0}
              variant="secondary"
            >
              Baixar Arquivo
            </Button>
          </div>
        </Card>
      </aside>

      {/* COLUNA DA DIREITA: CONTEÚDO PRINCIPAL */}
      <main className="page-container">
        {loading ? (
          <Card title="Pré-Visualização">
            <div className="loading-box" style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--text-color1)" }}>Carregando dados...</p>
            </div>
          </Card>
        ) : data && data.length > 0 ? (
          <Card title="Pré-Visualização">
            <Table columns={columns} data={data} />
          </Card>
        ) : (
          <Card title="Pré-Visualização">
            <div className="empty-state-box" style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--text-color1)", fontSize: "15px", marginBottom: "8px" }}>
                Nenhum dado encontrado para conversão nesta base.
              </p>
              <span style={{ fontSize: "13px", color: "#888" }}>
                Clique em <strong>Importar Arquivo</strong> para carregar os dados a serem exportados.
              </span>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}