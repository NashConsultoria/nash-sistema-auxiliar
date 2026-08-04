import React, { useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line
} from "recharts";

import Card from "../../components/card/Card";
import "./Chart.css";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>

        {payload.map((item, index) => (
          <p
            key={index}
            className="chart-tooltip-item"
            style={{ color: item.color }}
          >
            {item.name.toUpperCase()}:{" "}
            {item.value.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL"
            })}
          </p>
        ))}
      </div>
    );
  }

  return null;
};

export default function Chart({
  title,
  meses = [],
  data = [],
  series = [],
  xAxisKey = "name",
  printWidth = "100%"
}) {
  useEffect(() => {
    const beforePrint = () => {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
    };

    window.addEventListener("beforeprint", beforePrint);

    return () => {
      window.removeEventListener("beforeprint", beforePrint);
    };
  }, []);

  // Otimização: Memoização do tratamento de dados para evitar recalcular em re-renders simples
  const chartData = useMemo(() => {
    if (meses.length > 0) {
      return meses.map((mes, index) => {
        const ponto = { name: mes };

        series.forEach((serie) => {
          const linha = data.find((r) => r.descricao === serie.descricao);
          ponto[serie.descricao] = linha ? linha.valores[index] : 0;
        });

        return ponto;
      });
    }

    return data.map((item) => ({
      ...item,
      name: item[xAxisKey]
    }));
  }, [meses, series, data, xAxisKey]);

  // Cálculo proporcional dinâmico do tamanho das barras
  const { maxBarSize, barGap } = useMemo(() => {
    const quantidade = chartData.length;

    if (quantidade <= 3) return { maxBarSize: 90, barGap: 60 };
    if (quantidade <= 6) return { maxBarSize: 60, barGap: 35 };
    if (quantidade <= 12) return { maxBarSize: 35, barGap: 15 };

    return { maxBarSize: 40, barGap: 20 };
  }, [chartData.length]);

  return (
    <Card title={title}>
      <div className="chart-container">
        <ResponsiveContainer width={printWidth} height="100%">
          <ComposedChart
            data={chartData}
            barGap={barGap}
            margin={{
              top: 15,
              right: 25,
              left: 15,
              bottom: 15
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />

            <XAxis
              dataKey="name"
              interval={0}
              minTickGap={0}
              tickLine={false}
              padding={{ left: 15, right: 15 }}
            />

            <YAxis tickLine={false} axisLine={false} />

            <Tooltip content={<CustomTooltip />} />

            <Legend verticalAlign="bottom" height={36} />

            {series.map((serie, index) =>
              serie.type === "line" ? (
                <Line
                  key={index}
                  type="monotone"
                  dataKey={serie.descricao}
                  name={serie.descricao}
                  stroke={serie.color}
                  strokeWidth={3}
                />
              ) : (
                <Bar
                  key={index}
                  dataKey={serie.descricao}
                  name={serie.descricao}
                  fill={serie.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={maxBarSize}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}