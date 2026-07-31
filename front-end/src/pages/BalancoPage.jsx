import { useEffect, useState } from "react"
import Card from "../components/card/Card"
import Table from "../components/table/Table"
import Chart from "../components/chart/Chart"
import PieChart from "../components/chart/PieChart"

export default function BalancoPage() {

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

    return(
        <div className="page-container">
            <div className="dashboard-grid">
                <Card title="Dívida Líquida 26/27">
                    <div className="card-kpi-value">R$480M</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.7 }}>
                        Dívida Bruta - Caixa
                    </span>
                </Card>
                <Card title="Patrimônio Líquido 37/38">
                    <div className="card-kpi-value">R$3.177B</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                        Capital + Reservas + Lucros
                    </span>
                </Card>
                <Card title="Liquidez Corrente 37/38">
                    <div className="card-kpi-value">7,73x</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                        Ativo Circ / Passivo Circ
                    </span>
                </Card>
                <Card title="Alavancagem Máx.">
                    <div className="card-kpi-value">1,8x 25/26</div>
                    <span style={{ fontSize: "0.85rem", fontWeight: 400, opacity: 0.6 }}>
                        Dív.Líq./EBITDA → quitada 30/31
                    </span>
                </Card>
            </div>

            <Card title="Balanço Patrimoial NASH S.A. — Projeção (R$ mil)">
                <Table columns={colunas} data={dados} />
            </Card>

        </div>
    )
}
