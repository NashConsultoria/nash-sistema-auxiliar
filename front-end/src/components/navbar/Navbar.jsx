import { NavLink } from "react-router-dom";
import { FaCalculator, FaChartLine, FaFileAlt, FaMoneyBill, FaBox, FaCoins, FaBalanceScale, FaTable, FaFileImport, FaRegFileAlt } from "react-icons/fa";
import { FaArrowRotateRight } from "react-icons/fa6";
import "./NavBar.css";
import { useAuth } from "../../context/AuthContext";

const menu = [
    {
        label: "Simulator",
        path: "/simulator",
        icon: <FaCalculator />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Valuation",
        path: "/valuation",
        icon: <FaChartLine />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "DRE",
        path: "/dre",
        icon: <FaFileAlt />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Fluxo de Caixa",
        path: "/fluxocaixa",
        icon: <FaMoneyBill />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Folha de Pagamento",
        path: "/folhapagamento",
        icon: <FaRegFileAlt  />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Receita",
        path: "/receita",
        icon: <FaCoins />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Custos",
        path: "/custos",
        icon: <FaBox />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Balanço",
        path: "/balanco",
        icon: <FaBalanceScale />,
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Base",
        path: "/base",
        icon: <FaTable />,
        perfisPermitidos: [1, 2]
    },
    {
        label: "Importação",
        path: "/importacao",
        icon: <FaFileImport />,
        perfisPermitidos: [1]
    },
    {
        label: "Conversor",
        path: "/conversor",
        icon: <FaArrowRotateRight />,
        perfisPermitidos: [1, 2]
    },
];

export default function Navbar() {
    const { usuario } = useAuth();
        
    return (
        <nav className="navbar">
            <div className="nav-menu">
                {menu
                    // Filtra os itens: se o usuário for perfil 3 (Cliente), esconde os itens marcados
                    .filter((item) => {
                        // Se não houver restrição configurada no item, ele é exibido
                        if (!item.perfisPermitidos) return true;

                        // Converte para número por garantia para evitar problemas de string vs int
                        const perfilUsuario = Number(usuario?.perfil);

                        return item.perfisPermitidos.includes(perfilUsuario);
                    })
                    .map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === "/"}
                            className={({ isActive }) =>
                                isActive ? "nav-item active" : "nav-item"
                            }
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))
                }
            </div>
        </nav>
    );
}