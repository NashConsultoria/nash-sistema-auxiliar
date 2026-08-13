import { useEffect, useState } from "react"
import Card from "../components/card/Card"
import TableProjetado from "../components/table/TableProjetado"
import Chart from "../components/chart/Chart"
import PieChart from "../components/chart/PieChart"

export default function VDRE() {

    // Exemplo de 60 meses simulados (100.000 por mês)
    const mock60Meses = new Array(60).fill(100000);
    const mockDeducoes = new Array(60).fill(-10000);
    const mockCMV = new Array(60).fill(-50000);
    const mockMargem = new Array(60).fill(40000);

    const dadosMock = [
        {
            id: "receita",
            descricao: "RECEITA OPERACIONAL BRUTA",
            tipo: "calculo",
            level: 1,
            valores: mock60Meses,
        },
        {
            id: "deducao",
            descricao: "DEDUÇÃO DA RECEITA",
            tipo: "grupo",
            level: 2,
            valores: mockDeducoes,
        },
        {
            id: "cmv",
            descricao: "CMV / CUSTOS",
            tipo: "grupo",
            level: 2,
            valores: mockCMV,
        },
        {
            id: "margem",
            descricao: "MARGEM BRUTA",
            tipo: "calculo",
            level: 1,
            valores: mockMargem,
        },
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
        { categoria: "Marketing", custo: 5000, color: "#7ba0f7" },
        { categoria: "Infraestrutura", custo: 8500, color: "#3b82f6" },
        { categoria: "Pessoal", custo: 12000, color: "#22c55e" },
        { categoria: "Impostos", custo: 3200, color: "#ef4444" },
    ];
    
    return (
        <div className="page-container">
            <Card title="DRE - Projetado">
              <TableProjetado dados={dadosMock} anoInicial={2026} quantidadeAnos={5} />
            </Card>

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
        </div>
    );
}
