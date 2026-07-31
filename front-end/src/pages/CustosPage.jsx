import { useEffect, useState } from "react"
import Table from "../components/table/Table"
import Card from "../components/card/Card"
import Chart from "../components/chart/Chart"
import PieChart from "../components/chart/PieChart"

export default function CustosPage() {

    const colunas = [
        { label: "Data", key: "data" },
        { label: "Descrição", key: "descricao" },
        { label: "Categoria", key: "categoria" },
        { label: "Valor", key: "valor", align: "right" },
    ];

    const dados = [
        { data: "10/07/2026", descricao: "Assinatura Software", categoria: "Serviços", valor: "R$ 150,00" },
        { data: "12/07/2026", descricao: "Consultoria Financeira", categoria: "Receita", valor: "R$ 4.500,00" },
        { data: "15/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "17/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "20/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "23/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
        { data: "26/07/2026", descricao: "Compra de Servidor", categoria: "Infraestrutura", valor: "R$ 1.200,00" },
    ];
    
    return (
        <div className="page-container">
            <div className="dashboard-grid">
                <Card title="CPV Agri Caixa 37/38">
                    <div className="card-kpi-value">R$726.509M</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.7 }}>
                        Fornec + Parceiros + Colheita
                    </span>
                </Card>
                <Card title="CAPEX Total 37/38">
                    <div className="card-kpi-value">R$ 419M</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                        33% do EV · g=0,0%
                    </span>
                </Card>
                <Card title="CPV Caixa / ton (37/38)">
                    <div className="card-kpi-value">R$64/t</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                        R$ por tonelada moída
                    </span>
                </Card>
                <Card title="CAPEX / ton (37/38)">
                    <div className="card-kpi-value">R$30/t</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                        R$ por tonelada moída
                    </span>
                </Card>
            </div>

            <Card title="Custos Agroindustriais por Safra (R$ mil)">
                <Table columns={colunas} data={dados} />
            </Card>

            <div className="dashboard-grid">
                <Chart 
                    title="CAPEX: Imobilizado + Ativo Biológico (R$ MM)"
                    meses={colunas}
                    data={dados}
                    series={[
                        { descricao: "Receita Bruta", type: "bar", color: "#1e2942" },
                        { descricao: "EBITDA", type: "line", color: "#22c55e" } // Verde para o EBITDA
                    ]}
                />
                <Chart 
                    title="CPV Caixa Total vs D&A Total (R$ MM)"
                    meses={colunas}
                    data={dados}
                    series={[
                        { descricao: "Receita Bruta", type: "bar", color: "#1e2942" },
                        { descricao: "EBITDA", type: "line", color: "#22c55e" } // Verde para o EBITDA
                    ]}
                />
            </div>

        </div>
    );
}
