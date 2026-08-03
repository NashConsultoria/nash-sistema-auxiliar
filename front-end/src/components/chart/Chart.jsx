import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import Card from '../../components/card/Card';
import "./Chart.css";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((item, index) => (
          <p key={index} className="chart-tooltip-item" style={{ color: item.color }}>
            {item.name.toUpperCase()}: {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Chart({ title, meses = [], data = [], series = [], xAxisKey = "name" }) {
    
    let chartData = [];

    // Se "meses" foi informado, assume que os dados vêm no formato DRE (Matricial) e monta o formato plano
    if (meses.length > 0) {
        chartData = meses.map((mes, index) => {
            const pontoValores = { name: mes };
            series.forEach(serie => {
                const linhaDRE = data.find(r => r.descricao === serie.descricao);
                pontoValores[serie.descricao] = linhaDRE ? linhaDRE.valores[index] : 0;
            });
            return pontoValores;
        });
    } else {
        // Se NÃO passou o array "meses", assume que os dados já vieram prontos/planos (como o seu array dadosFinanceiros)
        chartData = data.map(item => ({
            ...item,
            name: item[xAxisKey] // Garante que o Recharts encontre a propriedade do eixo X
        }));
    }

    return (
        <Card title={title}>
            <div className="chart-container" style={{ width: '100%', height: 320, minWidth: 0, overflow: 'hidden' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border-color, #334155)" strokeDasharray="3 3" vertical={false} />
                        
                        {/* Usa a chave unificada "name" que tratamos na condição acima */}
                        <XAxis dataKey="name" tickLine={false} />
                        <YAxis tickLine={false} axisLine={false} />
                        
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        
                        {series.map((serie, index) => {
                            if (serie.type === 'line') {
                                return (
                                    <Line 
                                        key={index}
                                        type="monotone" 
                                        dataKey={serie.descricao} 
                                        name={serie.descricao} 
                                        stroke={serie.color || "#3b82f6"} 
                                        strokeWidth={3} 
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 6 }} 
                                    />
                                );
                            }
                            
                            return (
                                <Bar 
                                    key={index}
                                    dataKey={serie.descricao} 
                                    name={serie.descricao}
                                    fill={serie.color || "#0ea5e9"} 
                                    radius={[4, 4, 0, 0]} 
                                    maxBarSize={40} 
                                />
                            );
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}