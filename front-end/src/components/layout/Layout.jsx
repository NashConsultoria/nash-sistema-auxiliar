import { Outlet, useLocation } from "react-router-dom";
import "./Layout.css"
import Header from "../header/Header";
import Navbar from "../navbar/Navbar";
import { usePrint } from "../../context/PrintContext";

export default function Layout() {
    const location = useLocation();
    const { printData } = usePrint();
    const isLoginPage = location.pathname === "/" || location.pathname === "/login";

    return (
        <>
            {/* CABEÇALHO GENÉRICO DE IMPRESSÃO (Visível APENAS ao imprimir) */}
            {!isLoginPage && (
                <div className="header-impressao-only">
                    <div className="header-impressao-content">
                        <div className="header-logo">
                            <h2>Nash Consultoria</h2>
                        </div>
                        <div className="header-info">
                            <h1>{printData.titulo}</h1>
                            {printData.detalhes.length > 0 && (
                                <p>{printData.detalhes.join(" | ")}</p>
                            )}
                            <p><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                    <hr className="header-divisor" />
                </div>
            )}
            {/* O Header sempre aparece */}
            <Header />
            
            {/* A Navbar SÓ aparece se NÃO for a página de login */}
            {!isLoginPage && <Navbar />}

            <main className="container">
                <Outlet />
            </main>

            {/* Versão do sistema */}
            {!isLoginPage && (
                <div className="system-version">
                    Versão 0.0.6
                </div>
            )}
        </>
    );
}