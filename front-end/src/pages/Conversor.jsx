import { useState, useEffect } from "react";
import Table from "../components/table/Table";
import Card from "../components/card/Card";
import Button from "../components/button/Button";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../context/AuthContext";
import "../styles/global.css";

export default function Conversor() {
  const { token } = useAuth();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileSelected, setFileSelected] = useState(null);

  // ESTADOS DO CONTRATANTE
  const [contratantes, setContratantes] = useState([]);
  const [contratanteTexto, setContratanteTexto] = useState("");
  const [contratanteId, setContratanteId] = useState("");

  const API_URL = "http://127.0.0.1:8000/api";

  const columns = [
    { key: "contratante", label: "Contratante" },
    { key: "unidade", label: "Unidade" },
    { key: "banco", label: "Banco" },
    { key: "agencia", label: "Agência" },
    { key: "conta", label: "Conta" },
    { key: "data", label: "Data" },
    { key: "descricao", label: "Descrição" },
    { key: "obs", label: "Observação" },
    { key: "valor", label: "Valor" },
    { key: "tipo", label: "Tipo" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "cpf_cnpj", label: "CPF_CNPJ" },
    { key: "planoConta", label: "Plano de Conta" },
    { key: "grupoConta", label: "Grupo de Conta" },
    { key: "edre", label: "E-DRE" },
  ];

  // 1. Carrega a lista de contratantes ao montar a página
  useEffect(() => {
    carregarContratantes();
    return () => {
      setData([]);
    };
  }, []);

  const carregarContratantes = async () => {
      try {
          const res = await fetch(`${API_BASE}/api/contratantes`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error("Erro ao buscar contratantes");
          const dados = await res.json();
          setContratantes(dados);
      } catch (err) {
          console.error("Erro contratantes:", err);
      }
  };

  // 2. Ação de clicar no botão Importar/Trocar Arquivo
  const handleImportClick = () => {
    if (!contratanteId) {
      alert("Por favor, selecione um Contratante válido antes de importar o arquivo!");
      return;
    }
    document.getElementById("file-upload").click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".ofx") && !file.name.toLowerCase().endsWith(".pdf")) {
        alert("Apenas arquivos no formato .ofx e .pdf são permitidos!");
        return;
      }
      setFileSelected(file);
      setData([]);
    }
  };

  // 3. Converte enviando o contratanteId
  const handleConverter = async () => {
    if (!fileSelected || !contratanteId) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", fileSelected);
    formData.append("contratanteId", contratanteId);

    try {
      const response = await fetch(`${API_URL}/NashBancoConsultoria/conversor/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Erro ao processar o arquivo.");

      const result = await response.json();
      setData(result.transacoes || []);
    } catch (err) {
      console.error("Erro na conversão:", err);
      alert("Não foi possível converter o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Exporta enviando o contratanteId
  const handleExport = async () => {
    if (!fileSelected || !contratanteId) return;

    const formData = new FormData();
    formData.append("file", fileSelected);
    formData.append("contratanteId", contratanteId);

    try {
      const response = await fetch(`${API_URL}/NashBancoConsultoria/conversor/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Erro ao gerar o arquivo Excel.");

      const contratanteSel = contratantes.find(c => String(c.id) === String(contratanteId));
      const nomeContratante = contratanteSel ? (contratanteSel.nome || contratanteSel.razaoSocial) : "CONTRATANTE";

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BASE_FINANCEIRA_${nomeContratante.toUpperCase()}.xlsx`;
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
            
            {/* SELEÇÃO DE CONTRATANTE */}
            <div className="form-group">
              <label className="form-label">
                Contratante *
              </label>
              <input 
                type="text"
                list="lista-contratantes"
                placeholder="Digite ou escolha o contratante..."
                value={contratanteTexto}
                onChange={(e) => {
                  const texto = e.target.value;
                  setContratanteTexto(texto);

                  // Reseta arquivo e dados ao mudar o texto/contratante
                  setFileSelected(null);
                  setData([]);

                  const encontrado = contratantes.find(
                    (c) => (c.nome || c.razaoSocial || "").toLowerCase() === texto.trim().toLowerCase()
                  );
                  
                  setContratanteId(encontrado ? encontrado.id : "");
                }}
                className="form-input"
              />
              <datalist id="lista-contratantes">
                {contratantes.map((c, index) => {
                  const nomeC = c.nome || c.razaoSocial || "";
                  return (
                    <option 
                      key={c.id || index} 
                      value={nomeC} 
                    />
                  );
                })}
              </datalist>
            </div>

            <input
              type="file"
              id="file-upload"
              style={{ display: "none" }}
              onChange={handleFileChange}
              accept=".ofx,.pdf"
            />
            
            {/* O BOTÃO FICA DESABILITADO ATÉ UM CONTRATANTE VÁLIDO SER ENCONTRADO */}
            <Button 
              onClick={handleImportClick} 
              disabled={!contratanteId}
            >
              {fileSelected ? "Trocar Arquivo" : "Importar Arquivo"}
            </Button>

            {fileSelected && (
              <span style={{ fontSize: "var(--font-size2)", color: "var(--text-color3)", wordBreak: "break-all" }}>
                📄 {fileSelected.name}
              </span>
            )}

            <Button 
              onClick={handleConverter} 
              disabled={!fileSelected || !contratanteId || loading}
            >
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
              <p style={{ color: "var(--text-color3)", fontSize: "var(--font-size1)" }}>Carregando dados...</p>
            </div>
          ) : data && data.length > 0 ? (
            <div style={{ width: "100%", minHeight: "470px", maxHeight: "470px", overflow: "auto" }}>
              <Table columns={columns} data={data} />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: "var(--text-color3)", fontSize: "var(--font-size1)", marginBottom: "8px" }}>
                Nenhum dado convertido para visualização da base.
              </p>
              <span style={{ fontSize: "var(--font-size2)", color: "var(--text-color3)" }}>
                Selecione o <strong>Contratante</strong>, clique em <strong>Importar Arquivo</strong> e depois em <strong>Converter Arquivo</strong>.
              </span>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}