import "../../styles/global.css";
import "./Header.css";
import logo from "../../assets/NashLogo.png";
import { FaUserLarge } from "react-icons/fa6";
import { useNavigate , useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../button/Button";

export default function Header() {
    // Puxa os dados e funções do estado global de autenticação
    const { usuario } = useAuth();
    const location = useLocation();

    const estaNoLogin = location.pathname === "/login";

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

            {!estaNoLogin && usuario && (
                <div className="header-right">
                    {/* Informações textuais do usuário */}
                    <div className="header-user-info">
                        <span className="header-username">
                            {usuario.nome}
                        </span>
                        <span className="header-usertype">
                            {obterNomePerfil()}
                        </span>
                    </div>

                    {/* Ícone com link direto para a página de perfil */}
                    <Button isIcon onClick={() => navigate("/painel-controle")}><FaUserLarge /></Button>
                </div>
            )}
        </header>
    );
}