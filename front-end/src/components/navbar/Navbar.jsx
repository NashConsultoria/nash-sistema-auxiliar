import React, { useState, useEffect, useRef, useMemo } from "react";
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
    { label: "Simulator", path: "/simulator", icon: <FaCalculator />, modulo: "valuation", perfisPermitidos: [1, 2, 3] },
    { label: "Valuation", path: "/valuation", icon: <FaChartLine />, modulo: "valuation", perfisPermitidos: [1, 2, 3] },
    { label: "DRE Projetado", path: "/valuation-dre", icon: <FaChartLine />, modulo: "valuation", perfisPermitidos: [1, 2, 3] },

    // --- Módulo: Financeiro ---
    { label: "DRE", path: "/dre", icon: <FaFileAlt />, modulo: "financeiro", perfisPermitidos: [1, 2, 3] },
    { label: "Fluxo de Caixa", path: "/fluxo-caixa", icon: <FaMoneyBill />, modulo: "financeiro", perfisPermitidos: [1, 2, 3] },
    { label: "Folha de Pagamento", path: "/folha-pagamento", icon: <FaRegFileAlt />, modulo: "financeiro", perfisPermitidos: [1, 2, 3] },
    { label: "Receita", path: "/receita", icon: <FaCoins />, modulo: "financeiro", perfisPermitidos: [1, 2, 3] },
    { label: "Custos", path: "/custos", icon: <FaBox />, modulo: "financeiro", perfisPermitidos: [1, 2, 3] },
    { label: "Balanço", path: "/balanco", icon: <FaBalanceScale />, modulo: "financeiro", perfisPermitidos: [1, 2, 3] },

    // --- Módulo: Configurações / Ferramentas ---
    { label: "Importação", path: "/importacao", icon: <FaFileImport />, modulo: "config", perfisPermitidos: [1] },
    { label: "Conversor", path: "/conversor", icon: <FaArrowRotateRight />, modulo: "config", perfisPermitidos: [1, 2] },
    { label: "Base Financeira", path: "/base-financeira", icon: <FaTable />, modulo: "config", perfisPermitidos: [1, 2] },
    { label: "Base Fluxo Caixa", path: "/base-fluxo-caixa", icon: <FaTable />, modulo: "config", perfisPermitidos: [1, 2] },
    { label: "Base Folha", path: "/base-folha", icon: <FaTable />, modulo: "config", perfisPermitidos: [1, 2] },
];

export default function Navbar() {
    const { usuario } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [moduloAtivo, setModuloAtivo] = useState(MODULOS.FINANCEIRO.id);
    const [dropdownAberto, setDropdownAberto] = useState(false);
    const dropdownRef = useRef(null);

    const perfilUsuario = Number(usuario?.perfil);

    // Retorna apenas os módulos onde o usuário possui ao menos 1 item com permissão
    const modulosPermitidos = useMemo(() => {
        return Object.values(MODULOS).filter((mod) => {
            return menu.some((item) => {
                const temAcessoItem = !item.perfisPermitidos || item.perfisPermitidos.includes(perfilUsuario);
                return item.modulo === mod.id && temAcessoItem;
            });
        });
    }, [perfilUsuario]);

    // Identifica o módulo atual baseado na URL selecionada ou ajusta para o primeiro permitido
    useEffect(() => {
        const itemAtual = menu.find((item) => item.path === location.pathname);
        if (itemAtual && itemAtual.modulo) {
            setModuloAtivo(itemAtual.modulo);
        } else if (modulosPermitidos.length > 0) {
            // Se o módulo ativo atual não estiver nos permitidos, ajusta para o primeiro disponível
            const moduloEstaPermitido = modulosPermitidos.some((m) => m.id === moduloAtivo);
            if (!moduloEstaPermitido) {
                setModuloAtivo(modulosPermitidos[0].id);
            }
        }
    }, [location.pathname, modulosPermitidos, moduloAtivo]);

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

        const paginasDoModulo = menu.filter((item) => {
            const permissaoValida = !item.perfisPermitidos || item.perfisPermitidos.includes(perfilUsuario);
            return item.modulo === idModulo && permissaoValida;
        });

        if (paginasDoModulo.length > 0) {
            navigate(paginasDoModulo[0].path);
        }
    };

    // Filtra os botões de navegação para o módulo ativo
    const menuFiltrado = menu.filter((item) => {
        const permissaoValida = !item.perfisPermitidos || item.perfisPermitidos.includes(perfilUsuario);
        const moduloValido = item.modulo === moduloAtivo;
        return permissaoValida && moduloValido;
    });

    const moduloAtualObj = Object.values(MODULOS).find((m) => m.id === moduloAtivo) || modulosPermitidos[0] || MODULOS.FINANCEIRO;

    return (
        <nav className="navbar">
            <div className="nav-menu">
                {/* SELETOR DE MÓDULOS (Apenas exibe se houver mais de 0 módulos permitidos) */}
                {modulosPermitidos.length > 0 && (
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
                                {modulosPermitidos.map((mod) => (
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
                )}

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