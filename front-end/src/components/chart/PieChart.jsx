import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import Card from '../card/Card';
import "./Chart.css";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{data.name}</p>
        <p className="chart-tooltip-item" style={{ color: data.payload.fill }}>
          Valor: {data.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      </div>
    );
  }
  return null;
};

// Alterado o nome da função para PieChart e adicionado nameKey e dataKey flexíveis
export default function PieChart({ 
  title = "Distribuição", 
  meses = [], 
  data = [], 
  targetDescricoes = [], 
  mesSelecionado,
  nameKey = "name",
  dataKey = "value",
  isDonut = true 
}) {
    
    let chartData = [];

    // Se você passou targetDescricoes, significa que quer filtrar os dados da DRE (Lógica Dinâmica)
    if (targetDescricoes.length > 0) {
        const mesIndex = meses.indexOf(mesSelecionado);
        chartData = targetDescricoes.map(descricao => {
            const linhaDRE = data.find(r => r.descricao === descricao);
            return {
                name: descricao.toUpperCase(),
                value: linhaDRE && mesIndex !== -1 ? linhaDRE.valores[mesIndex] : 0
            };
        }).filter(item => item.value > 0);
    } else {
        // Se NÃO passou targetDescricoes, usa o array padrão enviado diretamente (Lógica Direta para custos)
        chartData = data.map(item => ({
            name: item[nameKey],
            value: item[dataKey],
            color: item.color // Mantém a cor customizada se o objeto tiver
        })).filter(item => item.value > 0);
    }

    const COLORS = ['#0ea5e9', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

    return (
        <Card title={mesSelecionado ? `${title} (${mesSelecionado})` : title}>
            <div className="chart-container" style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        
                        <Pie
                            data={chartData}
                            cx="50%" 
                            cy="50%" 
                            innerRadius={isDonut ? 55 : 0} 
                            outerRadius={80}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.color || COLORS[index % COLORS.length]} 
                                />
                            ))}
                        </Pie>
                    </RechartsPieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}