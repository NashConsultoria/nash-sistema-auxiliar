import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
    FaCalculator, FaChartLine, FaFileAlt, FaMoneyBill, 
    FaBox, FaCoins, FaBalanceScale, FaTable, FaFileImport, 
    FaRegFileAlt, FaLayerGroup, FaChevronDown 
} from "react-icons/fa";
import { FaArrowRotateRight } from "react-icons/fa6";
import "./NavBar.css";
import { useAuth } from "../../context/AuthContext";
import Button from "../button/Button";

// 1. Definição dos Módulos Disponíveis
const MODULOS = {
    VALUATION: { id: "valuation", label: "Módulo: Valuation" },
    FINANCEIRO: { id: "financeiro", label: "Módulo: Financeiro" },
    CONFIG: { id: "config", label: "Módulo: Configurações" }
};

// 2. Mapeamento do Menu com a chave "modulo"
const menu = [
    // --- Módulo: Valuation ---
    {
        label: "Simulator",
        path: "/simulator",
        icon: <FaCalculator />,
        modulo: "valuation",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Valuation",
        path: "/valuation",
        icon: <FaChartLine />,
        modulo: "valuation",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "DRE",
        path: "/valuation-dre",
        icon: <FaChartLine />,
        modulo: "valuation",
        perfisPermitidos: [1, 2, 3]
    },
    // --- Módulo: Financeiro ---
    {
        label: "DRE",
        path: "/dre",
        icon: <FaFileAlt />,
        modulo: "financeiro",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Fluxo de Caixa",
        path: "/fluxo-caixa",
        icon: <FaMoneyBill />,
        modulo: "financeiro",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Folha de Pagamento",
        path: "/folha-pagamento",
        icon: <FaRegFileAlt />,
        modulo: "financeiro",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Receita",
        path: "/receita",
        icon: <FaCoins />,
        modulo: "financeiro",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Custos",
        path: "/custos",
        icon: <FaBox />,
        modulo: "financeiro",
        perfisPermitidos: [1, 2, 3]
    },
    {
        label: "Balanço",
        path: "/balanco",
        icon: <FaBalanceScale />,
        modulo: "financeiro",
        perfisPermitidos: [1, 2, 3]
    },

    // --- Módulo: Configurações / Ferramentas ---
    {
        label: "Base",
        path: "/base",
        icon: <FaTable />,
        modulo: "config",
        perfisPermitidos: [1, 2]
    },
    {
        label: "Importação",
        path: "/importacao",
        icon: <FaFileImport />,
        modulo: "config",
        perfisPermitidos: [1]
    },
    {
        label: "Conversor",
        path: "/conversor",
        icon: <FaArrowRotateRight />,
        modulo: "config",
        perfisPermitidos: [1, 2]
    },
];

export default function Navbar() {
    const { usuario } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [moduloAtivo, setModuloAtivo] = useState(MODULOS.FINANCEIRO.id);
    const [dropdownAberto, setDropdownAberto] = useState(false);
    const dropdownRef = useRef(null);

    const perfilUsuario = Number(usuario?.perfil);

    // Identifica o módulo atual baseado na URL selecionada
    useEffect(() => {
        const itemAtual = menu.find((item) => item.path === location.pathname);
        if (itemAtual && itemAtual.modulo) {
            setModuloAtivo(itemAtual.modulo);
        }
    }, [location.pathname]);

    // Fecha o dropdown ao clicar fora dele
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownAberto(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Função para alterar módulo e navegar para a primeira página permitida
    const trocarModulo = (idModulo) => {
        setModuloAtivo(idModulo);
        setDropdownAberto(false);

        // Busca as páginas do novo módulo que o usuário tem permissão de acessar
        const paginasDoModulo = menu.filter((item) => {
            const permissaoValida = !item.perfisPermitidos || item.perfisPermitidos.includes(perfilUsuario);
            return item.modulo === idModulo && permissaoValida;
        });

        // Se houver páginas acessíveis no módulo, navega para a primeira
        if (paginasDoModulo.length > 0) {
            navigate(paginasDoModulo[0].path);
        }
    };

    // Filtra o menu por permissão E pelo módulo ativo para renderizar os botões
    const menuFiltrado = menu.filter((item) => {
        const permissaoValida = !item.perfisPermitidos || item.perfisPermitidos.includes(perfilUsuario);
        const moduloValido = item.modulo === moduloAtivo;
        return permissaoValida && moduloValido;
    });

    const moduloAtualObj = Object.values(MODULOS).find((m) => m.id === moduloAtivo) || MODULOS.FINANCEIRO;

    return (
        <nav className="navbar">
            <div className="nav-menu">
                {/* SELETOR DE MÓDULOS */}
                <div className="modulo-seletor-container" ref={dropdownRef} style={{ position: "relative" }}>
                    <Button 
                        onClick={() => setDropdownAberto(!dropdownAberto)}
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                    >
                        <FaLayerGroup />
                        <span>{moduloAtualObj.label}</span>
                        <FaChevronDown style={{ fontSize: "10px", marginLeft: "4px" }} />
                    </Button>

                    {dropdownAberto && (
                        <div className="modulo-dropdown">
                            {Object.values(MODULOS).map((mod) => (
                                <button
                                    key={mod.id}
                                    type="button"
                                    className={`modulo-dropdown-item ${moduloAtivo === mod.id ? "active" : ""}`}
                                    onClick={() => trocarModulo(mod.id)}
                                >
                                    {mod.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* BOTÕES DAS PÁGINAS DO MÓDULO */}
                {menuFiltrado.map((item) => (
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
                ))}
            </div>
        </nav>
    );
}