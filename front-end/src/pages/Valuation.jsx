import { useEffect, useState } from "react"
import Card from "../components/card/Card"
import Table from "../components/table/Table"
import Chart from "../components/chart/Chart"
import PieChart from "../components/chart/PieChart"

export default function Valuation() {

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

    const dadosFinanceiros = [
        { mes: "Jan", "Alimentação": 150, "Contas": 30 },
        { mes: "Fev", "Alimentação": 180, "Contas": 45 },
        { mes: "Mar", "Alimentação": 220, "Contas": 60 },
        { mes: "Abr", "Alimentação": 200, "Contas": 50 },
        { mes: "Mai", "Alimentação": 250, "Contas": 75 },
    ];

    const seriesConfig = [
        { descricao: "Alimentação", type: "bar", color: "#1e2942" },
        { descricao: "Contas", type: "line", color: "#FF6200" }
    ];

    const distribuicaoCustos = [
        { categoria: "Marketing", custo: 5000, color: "#1e2942" },
        { categoria: "Infraestrutura", custo: 8500, color: "#3b82f6" },
        { categoria: "Pessoal", custo: 12000, color: "#22c55e" },
        { categoria: "Impostos", custo: 3200, color: "#ef4444" },
    ];
    
    return (
        <div className="page-container">
          <Card title="Valor Econômico — Equity Value · NASH (R$ mil)" >
            <div className="card-kpi-value">R$ 1.152.223</div>
            <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.7 }}>
                Valor Operacional (DCF) − Dívida Líquida · WACC 7,50% real · g = 0,0% · 12 safras + perpetuidade
            </span>
            <div className="dashboard-grid">
            <Card title="Valor Operacional (EV)" >
                <div className="card-kpi-value">R$ 2.227 M</div>
            </Card>
            <Card title="(-) Dívida Líquida">
                <div className="card-kpi-value">R$ 1.075 M</div>
            </Card>
            <Card title="EV / EBITDA 37/38">
                <div className="card-kpi-value">3,81×</div>
            </Card>
          </div>
          </Card>
          <div className="dashboard-grid">
            <Card title="PV FCL Explícito">
                <div className="card-kpi-value">R$ 1.285M</div>
                <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.7 }}>
                    58% do EV · 12 safras
                </span>
            </Card>
            <Card title="PV Perpetuidade">
                <div className="card-kpi-value">R$ 942M</div>
                <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                    42% do EV · g=0,0%
                </span>
            </Card>
            <Card title="Valor Operacional (EV)">
                <div className="card-kpi-value">R$ 2.227M</div>
                <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                    EV/EBITDA 3,81×
                </span>
            </Card>
            <Card title="Dívida Líquida">
                <div className="card-kpi-value">R$ 1.075M</div>
                <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                    Dív.Líq/EBITDA 1,84×
                </span>
            </Card>
          </div>

          <div className="dashboard-grid">
              <Chart 
                    title="Gráfico de Barras"
                    xAxisKey="mes"
                    data={dadosFinanceiros}
                    series={seriesConfig}
                />
              <PieChart
                title="Gráfico de Pizza"
                data={distribuicaoCustos}
                nameKey="categoria"
                dataKey="custo"
                isDonut={false}
            />
          </div>
            <Card title="Tabela">
              <Table columns={colunas} data={dados} />
          </Card>
        </div>
    );
}
