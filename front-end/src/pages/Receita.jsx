import { useEffect, useState } from "react"
import Card from "../components/card/Card"
import Table from "../components/table/Table"
import Chart from "../components/chart/Chart"
import PieChart from "../components/chart/PieChart"

export default function Receita() {

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
    
    const distribuicaoCustos = [
        { categoria: "Marketing", custo: 5000, color: "#1e2942" },
        { categoria: "Infraestrutura", custo: 8500, color: "#3b82f6" },
        { categoria: "Pessoal", custo: 12000, color: "#22c55e" },
        { categoria: "Impostos", custo: 3200, color: "#ef4444" },
    ];

    return(
        
        <div className="page-container">
            <Card title="Receita Bruta por Produto (R$ mil)">
                <Table columns={colunas} data={dados} />
            </Card>

            <div className="dashboard-grid">
                <Chart 
                    title="Receita Bruta Empilhada (R$ MM)"
                    meses={colunas}
                    data={dados}
                    series={[
                        { descricao: "EBITDA", type: "line", color: "#22c55e" },
                        { descricao: "Lucro Liquido", type: "line", color: "#3b82f6" } // Azul para o Lucro Líquido
                    ]}
                />
                <PieChart
                    title="Teste"
                    data={distribuicaoCustos}
                    nameKey="categoria"
                    dataKey="custo"
                    isDonut={false}
                />
            </div>
        </div>
        
    );
}
