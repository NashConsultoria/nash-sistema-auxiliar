import "../../styles/global.css";
import "./Header.css";
import logo from "../../assets/NashLogo.png";
import { FaUserLarge } from "react-icons/fa6";
import { FaMoon, FaCircle } from "react-icons/fa";
import { useNavigate , useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../button/Button";
import { useState, useEffect } from "react";

export default function Header() {
    // Puxa os dados e funções do estado global de autenticação
    const { usuario } = useAuth();
    const location = useLocation();

    const estaNoLogin = location.pathname === "/login";

    // 1. Inicialização inteligente: Verifica LocalStorage > depois o Sistema
    const [escuro, setEscuro] = useState(() => {
        const temaSalvo = localStorage.getItem("tema");
        
        if (temaSalvo !== null) {
            return temaSalvo === "dark";
        }
        
        // Fallback: usa a preferência do navegador/S.O. caso não haja histórico
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    // 2. Aplica a classe no body e salva a escolha no localStorage
    useEffect(() => {
        if (escuro) {
            document.body.classList.add("dark-theme");
            localStorage.setItem("tema", "dark");
        } else {
            document.body.classList.remove("dark-theme");
            localStorage.setItem("tema", "light");
        }
    }, [escuro]);

    // Alternância manual ao clicar no botão
    const toggleTema = () => {
        setEscuro((prev) => !prev);
    };

    const navigate = useNavigate();

    // Dicionário simples para mapear o tipo de perfil de forma limpa
    const obterNomePerfil = () => {
        if (!usuario) return "";
        if (usuario.protegido === 1) return "Administrador Supremo";
        
        const perfis = {
            1: "Administrador",
            2: "Funcionário",
            3: "Cliente"
        };
        return perfis[usuario.perfil] || "Usuário";
    };

    return (
        <header className="header">
            <div className="header-left">
                <img src={logo} alt="NashLogo"/>
            </div>

            <div className="header-midle">
                <h1>NashBI</h1>
            </div>

            <div className="header-right">
                {/* As informações e o botão do perfil só aparecem quando logado */}
                {!estaNoLogin && usuario && (
                    <>
                        <div className="header-user-info">
                            <span className="header-username">
                                {usuario.nome}
                            </span>
                            <span className="header-usertype">
                                {obterNomePerfil()}
                            </span>
                        </div>

                        <Button isIcon onClick={() => navigate("/painel-controle")}>
                            <FaUserLarge />
                        </Button>
                    </>
                )}

                {/* Botão de tema sempre fica na direita (no login e logado) */}
                <Button isIcon onClick={toggleTema}>
                    {escuro ? <FaMoon /> : <FaCircle />}
                </Button>
            </div>
        </header>
    );
}