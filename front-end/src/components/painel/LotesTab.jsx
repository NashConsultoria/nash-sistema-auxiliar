import { useState, useEffect, useMemo } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import { API_BASE } from "../../context/AuthContext";
import { ExportarExcel } from "../../utils/ExportarExcel";

export default function LotesTab({ token, banco, lotes = [], carregandoLotes, carregarLotes }) {
    // Estados dos Filtros
    const [filtros, setFiltros] = useState({
        nomeArquivo: "",
        contratante: ""
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nomeArquivo: "",
            contratante: ""
        });
    };

    useEffect(() => {
        if (token && carregarLotes) {
            carregarLotes();
        }
    }, [token]);

    // Função auxiliar estilo Excel (ignora a própria chave para calcular as opções disponíveis)
    const filtrarLotesExcecao = (chaveIgnorada) => {
        return lotes.filter((item) => {
            const arquivo = (item.nomeArquivo || item.nome_arquivo || "").toLowerCase();
            const contratante = (item.contratante || "").toLowerCase();

            return (
                (chaveIgnorada === "nomeArquivo" || arquivo.includes(filtros.nomeArquivo.toLowerCase().trim())) &&
                (chaveIgnorada === "contratante" || contratante.includes(filtros.contratante.toLowerCase().trim()))
            );
        });
    };

    // Opções dinâmicas das listas (estilo Excel)

    const opcoesArquivos = useMemo(() => {
        const dados = filtrarLotesExcecao("nomeArquivo");
        return Array.from(new Set(dados.map((l) => l.nomeArquivo || l.nome_arquivo).filter(Boolean)));
    }, [lotes, filtros]);

    const opcoesContratantes = useMemo(() => {
        const dados = filtrarLotesExcecao("contratante");
        return Array.from(new Set(dados.map((l) => l.contratante).filter(Boolean)));
    }, [lotes, filtros]);

    // Schema do Filtro
    const schemaFiltroLotes = [
        {
            key: "nomeArquivo",
            label: "Nome do Arquivo",
            tipo: "inputlist",
            placeholder: "Buscar arquivo...",
            options: opcoesArquivos
        },
        {
            key: "contratante",
            label: "Contratante",
            tipo: "inputlist",
            placeholder: "Buscar contratante...",
            options: opcoesContratantes
        }
    ];

    // Resultado final filtrado exibido na tabela
    const lotesFiltrados = useMemo(() => {
        return lotes.filter((item) => {
            const arquivo = (item.nomeArquivo || item.nome_arquivo || "").toLowerCase();
            const contratante = (item.contratante || "").toLowerCase();

            return (
                arquivo.includes(filtros.nomeArquivo.toLowerCase().trim()) &&
                contratante.includes(filtros.contratante.toLowerCase().trim())
            );
        });
    }, [lotes, filtros]);

    // Exportação customizada por tipo de lote
    const handleExportarLote = (row) => {
        const nomeOriginal = row.nomeArquivo ? row.nomeArquivo.replace(/\.[^/.]+$/, "") : `Lote_${row.id}`;
        const nomeArquivoDownload = `${nomeOriginal}.xlsx`;

        const ehPlanoContas = 
            row.nomeArquivo?.toLowerCase().includes("plano") || 
            row.contratante === "PLANO DE CONTAS (SISTEMA)";

        const ehFolhaPagamento = 
            row.nomeArquivo?.toLowerCase().includes("folha") || 
            row.tipoLote?.toLowerCase().includes("folha") ||
            row.contratante?.toLowerCase().includes("folha");

        if (ehPlanoContas) {
            ExportarExcel({
                tabela: "planocontas",
                colunas: ["PLANO DE CONTAS", "GRUPO DE CONTAS", "edre", "dfc", "efolha"],
                nomeArquivoCustomizado: nomeArquivoDownload
            });
        } else if (ehFolhaPagamento) {
            ExportarExcel({
                tabela: "movimentacaofolhapagamento",
                colunaFiltro: "importacaoLoteId",
                valorFiltro: row.id,
                colunas: [
                    "CONTRATANTE", "UNIDADE REGISTRO", "UNIDADE ATUACAO", "CNPJ", "NOME",
                    "CPF", "DATA NASCIMENTO", "CBO CARGO", "CARGO", "DEPARTAMENTO",
                    "DATA ADMISSAO", "DESCRICAO", "PLANO DE CONTA", "GRUPO DE CONTA",
                    "E-FOLHA", "DATA COMPETENCIA", "DATA CAIXA", "TIPO", "VALOR"
                ],
                nomeArquivoCustomizado: nomeArquivoDownload
            });
        } else {
            ExportarExcel({
                tabela: "movimentacao",
                colunaFiltro: "importacaoLoteId",
                valorFiltro: row.id,
                colunas: [
                    "CONTRATANTE", "UNIDADE", "BANCO", "AGENCIA", "CONTA", "DATA",
                    "DESCRICAO", "OBSERVACAO", "VALOR", "TIPO", "FORNECEDORES",
                    "CPF_CNPJ", "PLANO DE CONTA", "GRUPO DE CONTA", "E-DRE"
                ],
                nomeArquivoCustomizado: nomeArquivoDownload
            });
        }
    };

    // Exclusão do Lote
    const handleDeletarLote = async (loteId, nomeArquivo) => {
        const confirmou = window.confirm(
            `Tem certeza que deseja excluir o lote "${nomeArquivo}"?\nTodas as movimentações e cadastros órfãos deste lote serão removidos!`
        );

        if (!confirmou) return;

        try {
            const res = await fetch(`${API_BASE}/api/${banco}/lotes/${loteId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            const dados = await res.json();

            if (res.ok && dados.sucesso) {
                alert(dados.mensagem || "Lote excluído com sucesso!");
                if (carregarLotes) carregarLotes();
            } else {
                alert(`Erro: ${dados.mensagem || "Não foi possível excluir o lote."}`);
            }
        } catch (err) {
            console.error("Erro ao deletar lote:", err);
            alert("Erro de conexão ao tentar excluir o lote.");
        }
    };

    const colunasLotes = [
        { label: "Arquivo", key: "nomeArquivo", width: "27%" },
        { label: "Contratante", key: "contratante", width: "20%" },
        { 
            label: "Data Importação", 
            key: "criadoEm", 
            width: "20%",
            Cell: ({ row }) => row.criadoEm ? new Date(row.criadoEm).toLocaleString("pt-BR") : "-"
        },
        { label: "Linhas", key: "totalMovimentacoes", width: "10%" },
        {
            label: "Ações",
            key: "acoes",
            width: "15%",
            style: { textAlign: "center" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button
                        onClick={() => handleExportarLote(row)}
                        style={{
                            backgroundColor: "#3b82f622",
                            color: "#60a5fa",
                            border: "1px solid #3b82f644",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        Baixar
                    </Button>
                    <Button
                        onClick={() => handleDeletarLote(row.id, row.nome_arquivo || row.nomeArquivo)}
                        style={{
                            backgroundColor: "#ef444422",
                            color: "#f87171",
                            border: "1px solid #ef444444",
                            padding: "6px 12px",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        Excluir
                    </Button>
                </div>
            )
        }
    ];

    return (
        <Card title="Lotes Importados">
            <p style={{ marginBottom: "16px" }}>
                Visualize o histórico de lotes importados no sistema, faça o download dos arquivos em Excel ou exclua lançamentos antigos.
            </p>

            <FiltroBar
                schema={schemaFiltroLotes}
                filtros={filtros}
                onChange={handleFilterChange}
                onLimpar={limparFiltros}
            />

            {carregandoLotes ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                    Carregando histórico de importações...
                </div>
            ) : (
                <Table columns={colunasLotes} data={lotesFiltrados} />
            )}
        </Card>
    );
}