import { useEffect, useState } from "react"
import Table from "../components/table/Table"
import Card from "../components/card/Card"
import "../components/ImportPage.css"
import { useAuth } from "../context/AuthContext"

export default function Importacao() {

    const { token } = useAuth();

    // 1. ESTADOS DA PÁGINA
    const [databases, setDatabases] = useState([]);
    const [selectedDb, setSelectedDb] = useState(() => {
        // Se o usuário já escolheu um banco antes, ele mantém!
        return localStorage.getItem("nash_selected_db") || "";
    }); 
    const [tabelas, setTabelas] = useState([]);
    const [selectedTable, setSelectedTable] = useState("");
    const [dadosTabela, setDadosTabela] = useState([]);
    const [columns, setColumns] = useState([]);
    const [loadingTabelas, setLoadingTabelas] = useState(true);
    const [loadingDados, setLoadingDados] = useState(false);
    const [uploading, setUploading] = useState(false);

    const API_URL = "http://127.0.0.1:8000/api";

    // PRIMEIRO: Busca as bases de dados disponíveis no servidor
    useEffect(() => {
        setLoadingTabelas(true);
        fetch(`${API_URL}/databases`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setDatabases(data);
                
                // Ajuste inteligente: Se não houver banco salvo no localStorage OU o banco salvo não existir mais no SQL Server
                const bancoSalvoExiste = data.includes(localStorage.getItem("nash_selected_db"));
                if (data.length > 0 && (!selectedDb || !bancoSalvoExiste)) {
                    setSelectedDb(data[0]);
                    localStorage.setItem("nash_selected_db", data[0]);
                } else {
                    setLoadingTabelas(false);
                }
            })
            .catch((err) => {
                console.error("Erro ao buscar bancos de dados:", err);
                setLoadingTabelas(false);
            });
    }, []);

    // Função para quando o usuário trocar o select manualmente
    const handleDatabaseChange = (e) => {
        const novoBanco = e.target.value;
        setSelectedDb(novoBanco);
        localStorage.setItem("nash_selected_db", novoBanco); // Salva na memória do navegador
    };

    // SEGUNDO: Busca as tabelas toda vez que o banco ('selectedDb') mudar
    useEffect(() => {
        if (!selectedDb) return;

        setLoadingTabelas(true);
        fetch(`${API_URL}/${selectedDb}/tabelas`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setTabelas(data);
                setLoadingTabelas(false);
                if (data.length > 0) {
                    setSelectedTable(data[0].nome_completo);
                } else {
                    setSelectedTable("");
                    setDadosTabela([]);
                    setColumns([]);
                }
            })
            .catch((err) => {
                console.error("Erro ao buscar tabelas do banco:", err);
                setLoadingTabelas(false);
            });
    }, [selectedDb]);

    // TERCEIRO: Busca os dados reais da tabela
    useEffect(() => {
        if (!selectedDb || !selectedTable) return;

        setLoadingDados(true);
        fetch(`${API_URL}/${selectedDb}/dados/${selectedTable}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setDadosTabela(data);
                if (data.length > 0) {
                    // Monta as colunas baseado nas propriedades do primeiro objeto retornado
                    setColumns(Object.keys(data[0]).map(key => ({ key, label: key })));
                } else {
                    setColumns([]);
                }
                setLoadingDados(false);
            })
            .catch((err) => {
                console.error("Erro ao buscar dados:", err);
                setLoadingDados(false);
            });
    }, [selectedTable, selectedDb]);

    const handleRefresh = () => {
        const tabelaAtual = selectedTable;
        setSelectedTable("");
        setTimeout(() => setSelectedTable(tabelaAtual), 10);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Se o backend usar o banco selecionado na sessão/token ou no banco padrão, 
        // a validação do selectedDb continua válida para UX
        if (!selectedDb) {
            alert("Por favor, selecione um banco de dados primeiro!");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);

        try {
            // 1. Aponta para a nova URL limpa (sem o ${selectedDb} na rota)
            const response = await fetch(`${API_URL}/importar-arquivo`, {
                method: "POST",
                headers: { 
                    Authorization: `Bearer ${token}` 
                    // NOTA: Nunca adicione 'Content-Type': 'multipart/form-data' manualmente no fetch,
                    // o navegador faz isso sozinho ao identificar o FormData.
                },
                body: formData,
            });

            const data = await response.json();
            setUploading(false);

            // 2. Trata erros retornados por HTTPException (status 400, 401, 500, etc.)
            if (!response.ok) {
                const mensagemErro = data.detail || data.mensagem || "Ocorreu um erro ao processar o arquivo.";
                alert(`Erro (${response.status}): ${mensagemErro}`);
                return;
            }

            // 3. Sucesso na importação
            if (data.sucesso) {
                alert(data.mensagem);
                
                // Opcional: Feedback customizado dependendo do tipo retornado pelo backend
                if (data.tipo === "plano_contas") {
                    console.log("Plano de contas atualizado:", data.total_registros);
                }

                // Atualiza a listagem/tela
                if (typeof handleRefresh === "function") {
                    handleRefresh(); 
                }
            } else {
                alert("Erro: " + (data.mensagem || "Não foi possível concluir a importação."));
            }

        } catch (err) {
            setUploading(false);
            console.error("Erro no upload:", err);
            alert("Erro de conexão com o servidor ao enviar o arquivo.");
        }
    };

    return (
        <div className="import-container">
            
            {/* COLUNA DA ESQUERDA: BARRA LATERAL */}
            <aside className="import-sidebar">
                
                {/* Card 1: Seleção da Base */}
                <Card title="📁 Base de Dados">
                    <div className="database-selector-box">
                        <select 
                            className="import-select" 
                            value={selectedDb} 
                            onChange={handleDatabaseChange}
                        >
                            {databases.length === 0 ? (
                                <option value="">Nenhum banco encontrado</option>
                            ) : (
                                databases.map((db) => (
                                    <option key={db} value={db}>{db}</option>
                                ))
                            )}
                        </select>
                        <span className="database-size">Bases online no servidor</span>
                    
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "15px", marginTop: "10px" }}>
                            <label className="btn-refresh" style={{ display: "block", textAlign: "center", cursor: "pointer", backgroundColor: uploading ? "#94a3b8" : "#35448a", color: "#fff", padding: "8px", borderRadius: "6px" }}>
                                {uploading ? "📥 Importando..." : "📤 Subir Planilha Excel"}
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    onChange={handleFileUpload} 
                                    disabled={uploading}
                                    style={{ display: "none" }} // Esconde o input feio nativo do HTML
                                />
                            </label>
                        </div>
                    </div>
                </Card>

                {/* Card 2: Lista de Tabelas Dinâmica */}
                <Card title="🗂️ Tabelas">
                    <div className="tables-list-container">
                        <span className="context-subtitle">{selectedDb || "Nenhum banco"}</span>
                        
                        {loadingTabelas ? (
                            <div style={{ fontSize: "13px", color: "#64748b", padding: "10px 0" }}>
                                Carregando tabelas...
                            </div>
                        ) : tabelas.length === 0 ? (
                            <div style={{ 
                                fontSize: "13px", 
                                color: "#b45309", 
                                backgroundColor: "#fffbeb", 
                                border: "1px solid #fef3c7", 
                                padding: "12px", 
                                borderRadius: "6px",
                                marginTop: "10px",
                                lineHeight: "1.4"
                            }}>
                                ⚠️ <strong>Banco de dados vazio!</strong><br/>
                                Nenhuma tabela encontrada. Faça a primeira importação de planilha para inicializar o banco.
                            </div>
                        ) : (
                            <ul className="tables-list">
                                {tabelas.map((tab) => (
                                    <li 
                                        key={tab.nome_completo}
                                        className={`table-item ${selectedTable === tab.nome_completo ? "active" : ""}`}
                                        onClick={() => setSelectedTable(tab.nome_completo)}
                                    >
                                        <span className="table-name">{tab.nome_completo}</span>
                                        <span className="table-badge">{tab.registros}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Card>
            </aside>

            {/* COLUNA DA DIREITA: CONTEÚDO PRINCIPAL */}
            <main className="import-main-content">

                <div className="table-status-bar">
                    <div className="status-meta">
                        <h2>{selectedTable || "Nenhuma tabela selecionada"}</h2>
                        <span className="status-records">
                            {dadosTabela.length} registros
                        </span>
                        {dadosTabela.length > 0 && (
                            <div className="status-badge-success">✓ Exibindo {dadosTabela.length} de {dadosTabela.length} registros</div>
                        )}
                    </div>
                </div>

                {/* Card da Tabela com validação de Loading */}
                <Card>
                    {loadingDados ? (
                        <div style={{ padding: "20px", textAlign: "center", fontSize: "14px", color: "#64748b" }}>
                            Buscando dados no SQL Server...
                        </div>
                    ) : dadosTabela.length > 0 ? (
                            <Table columns={columns} data={dadosTabela} />
                    ) : (
                        <div style={{ padding: "20px", textAlign: "center", fontSize: "14px", color: "#64748b" }}>
                            Nenhum registro encontrado para esta tabela.
                        </div>
                    )}
                </Card>
            </main>

        </div>
    );
}