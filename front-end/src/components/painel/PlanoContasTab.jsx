import { useState, useEffect } from "react";
import Card from "../card/Card";
import Table from "../table/Table";
import Button from "../button/Button";
import { API_BASE } from "../../context/AuthContext";

export default function PlanoContasTab({ token, banco }) {
    // Estados para o Plano de Contas
    const [planoContas, setPlanoContas] = useState([]);
    const [carregandoPlano, setCarregandoPlano] = useState(false);

    // Estados para as Regras
    const [regras, setRegras] = useState([]);
    const [carregandoRegras, setCarregandoRegras] = useState(false);

    // 1. Busca do Plano de Contas no backend
    const carregarPlanoContas = async () => {
        if (!token) return;
        setCarregandoPlano(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco || "NashBancoConsultoria"}/planocontas`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar plano de contas");
            const dados = await res.json();
            
            // Aceita resposta direta em array ou objeto { sucesso: true, dados: [...] }
            setPlanoContas(Array.isArray(dados) ? dados : dados.dados || []);
        } catch (err) {
            console.error("Erro ao carregar plano de contas:", err);
        } finally {
            setCarregandoPlano(false);
        }
    };

    // 2. Busca das Regras de Associação/Mapeamento
    const carregarRegras = async () => {
        if (!token) return;
        setCarregandoRegras(true);
        try {
            const res = await fetch(`${API_BASE}/api/regras-planocontas`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar regras");
            const dados = await res.json();
            
            setRegras(Array.isArray(dados) ? dados : dados.regras || []);
        } catch (err) {
            console.error("Erro ao carregar regras:", err);
        } finally {
            setCarregandoRegras(false);
        }
    };

    useEffect(() => {
        carregarPlanoContas();
        carregarRegras();
    }, [token, banco]);

    // Colunas para a tabela de Regras
    const colunasRegras = [
        { label: "ID", key: "id", width: "8%" },
        { label: "Regra / Nome", key: "nome", width: "30%" },
        { label: "Tipo / Condição", key: "tipo", width: "25%" },
        { 
            label: "Mapeia Para", 
            key: "destino", 
            width: "25%",
            Cell: ({ row }) => (
                <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                    {row.destino || row.contaDestino || "-"}
                </span>
            )
        },
        {
            label: "Status",
            key: "ativo",
            width: "12%",
            Cell: ({ row }) => (
                <span style={{
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: row.ativo ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: row.ativo ? "#16a34a" : "#dc2626",
                    border: `1px solid ${row.ativo ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                }}>
                    {row.ativo ? "Ativo" : "Inativo"}
                </span>
            )
        }
    ];

    // Colunas para a tabela do Plano de Contas
    const colunasPlanoContas = [
        { label: "Plano de Contas", key: "planoConta", width: "30%" },
        { label: "Grupo de Contas", key: "grupoConta", width: "25%" },
        { label: "e-DRE", key: "edre", width: "15%" },
        { label: "DFC", key: "dfc", width: "15%" },
        { label: "e-Folha", key: "efolha", width: "15%" }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* SEÇÃO 1: REGRAS CONFIGURADAS */}
            <Card title="Regras de Mapeamento do Plano de Contas">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                        Regras automáticas aplicadas durante o vínculo e importação de movimentações.
                    </p>
                    <Button 
                        onClick={carregarRegras}
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                    >
                        Atualizar Regras
                    </Button>
                </div>

                {carregandoRegras ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                        Carregando regras configuradas...
                    </div>
                ) : (
                    <Table columns={colunasRegras} data={regras} />
                )}
            </Card>

            {/* SEÇÃO 2: PLANO DE CONTAS */}
            <Card title="Gerenciamento do Plano de Contas">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                        Estrutura completa das contas cadastradas no banco de dados.
                    </p>
                    <Button 
                        onClick={carregarPlanoContas}
                        style={{ padding: "6px 12px", fontSize: "13px" }}
                    >
                        Recarregar Tabela
                    </Button>
                </div>

                {carregandoPlano ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                        Carregando plano de contas...
                    </div>
                ) : (
                    <Table columns={colunasPlanoContas} data={planoContas} />
                )}
            </Card>
        </div>
    );
}