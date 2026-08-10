import { useState, useEffect } from "react";
import Table from "../components/table/Table";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import { useAuth } from "../context/AuthContext";
import "../styles/global.css";

export default function ConversorPage() {
  const { token } = useAuth();
  
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
    { key: "obs", label: "Observação" },
    { key: "valor", label: "Valor" },
    { key: "tipo", label: "Tipo" },
    { key: "fornecedores", label: "Fornecedor" },
  ];

  useEffect(() => {
    return () => {
      setData([]);
    };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".ofx")) {
        alert("Apenas arquivos no formato .ofx ou .pdf são permitidos!");
        return;
      }
      setFileSelected(file);
      setData([]);
    }
  };

  const handleConverter = async () => {
    if (!fileSelected) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", fileSelected);

    try {
      const response = await fetch(`${API_URL}/NashBancoConsultoria/conversor/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Erro ao processar o arquivo OFX.");

      const result = await response.json();
      setData(result.transacoes || []);
    } catch (err) {
      console.error("Erro na conversão:", err);
      alert("Não foi possível converter o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!fileSelected) return;

    const formData = new FormData();
    formData.append("file", fileSelected);

    try {
      const response = await fetch(`${API_URL}/NashBancoConsultoria/conversor/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Erro ao gerar o arquivo Excel.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "BASE_FINANCEIRA_CONTRATANTE_MES.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setData([]);
      setFileSelected(null);
    } catch (err) {
      console.error("Erro ao baixar o arquivo:", err);
      alert("Erro ao realizar o download da planilha.");
    }
  };

  return (
    <div className="page-horizontal">
      {/* COLUNA DA ESQUERDA: BARRA LATERAL DE AÇÕES */}
      <aside className="page-left">
        <Card title="Ações">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
              <span style={{ fontSize: "var(--font-size2)", color: "var(--text-color1)", wordBreak: "break-all" }}>
                📄 {fileSelected.name}
              </span>
            )}

            <Button onClick={handleConverter} disabled={!fileSelected || loading}>
              Converter Arquivo
            </Button>

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

      {/* COLUNA DA DIREITA: CONTEÚDO PRINCIPAL DE PRÉ-VISUALIZAÇÃO */}
      <main className="page-right">
        <Card title="Pré-Visualização">
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--text-color1)", fontSize: "var(--font-size1)" }}>Carregando dados...</p>
            </div>
          ) : data && data.length > 0 ? (
            <div style={{ width: "100%", minHeight: "470px", maxHeight: "470px", overflow: "auto" }}>
              <Table columns={columns} data={data} />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--text-color1)", fontSize: "var(--font-size1)", marginBottom: "8px" }}>
                Nenhum dado convertido para conversão nesta base.
              </p>
              <span style={{ fontSize: "var(--font-size2)", color: "var(--title-color2)" }}>
                Clique em <strong>Importar Arquivo</strong> e depois em <strong>Converter Arquivo</strong> para visualizar os dados.
              </span>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}