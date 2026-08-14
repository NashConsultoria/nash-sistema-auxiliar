import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../components/PainelControle.css"; 
import Card from "../components/card/Card";
import Button from "../components/button/Button"

import PerfilTab from "../components/painel/PerfilTab";
import UsuariosTab from "../components/painel/UsuariosTab";
import PermissoesTab from "../components/painel/PermissoesTab";
import ContratantesTab from "../components/painel/ContratantesTab";
import PlanoContasTab from "../components/painel/PlanoContasTab";
import LotesTab from "../components/painel/LotesTab";
import LogsTab from "../components/painel/LogsTab";

import { API_BASE } from "../context/AuthContext";
import { useAuth } from "../context/AuthContext";

import { CiSettings, CiLogout } from "react-icons/ci";
import { FaUsers } from "react-icons/fa6";
import { FaUser, FaHistory  } from "react-icons/fa";
import { IoMdSettings } from "react-icons/io";
import { GrUserManager, GrPlan } from "react-icons/gr";
import { BiImport } from "react-icons/bi";

export default function PainelControle() {
    const navigate = useNavigate();
    const { logout, usuario, setUsuario, token } = useAuth();
    const banco = usuario?.banco || "NashBancoConsultoria";

    const [abaAtiva, setAbaAtiva] = useState("perfil");
    const [contratantes, setContratantes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [carregandoLotes, setCarregandoLotes] = useState(false);

    const carregarContratantes = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/contratantes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar contratantes");
            const dados = await res.json();
            setContratantes(dados);
        } catch (err) {
            console.error("Erro contratantes:", err);
        }
    };

    const carregarUsuarios = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/usuarios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar usuários");
            const dados = await res.json();
            setUsuarios(dados);
        } catch (err) {
            console.error("Erro usuários:", err);
        }
    };

    const carregarLotes = async () => {
        setCarregandoLotes(true);
        try {
            const res = await fetch(`${API_BASE}/api/${banco}/lotes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar lotes");
            const dados = await res.json();
            if (dados.sucesso) {
                setLotes(dados.lotes);
            }
        } catch (err) {
            console.error("Erro lotes:", err);
        } finally {
            setCarregandoLotes(false);
        }
    };

    useEffect(() => {
        if (usuario && (usuario.perfil === 1 || usuario.protegido === 1)) {
            carregarUsuarios();
            carregarContratantes();
            carregarLotes();
        }
    }, [usuario]);

    const handleLogout = () => {
        if (window.confirm("Deseja realmente sair do sistema?")) {
            logout();
            navigate("/login"); 
        }
    };

    return (
        <div className="usuario-page-layout">
            {/* SIDEBAR */}
            <aside className="page-sidebar">
                <Card title="Painel de Controle">
                    <div className="sidebar-menu">
                        <Button 
                            className={`menu-btn ${abaAtiva === "perfil" ? "active" : ""}`}
                            onClick={() => setAbaAtiva("perfil")}
                        >
                            <FaUser />
                            <span>Perfil</span>
                        </Button>

                        {(usuario?.perfil === 1 || usuario?.id === 1) && (
                            <>
                                <Button 
                                    className={`menu-btn ${abaAtiva === "usuarios" ? "active" : ""}`}
                                    onClick={() => setAbaAtiva("usuarios")}
                                >
                                    <FaUsers />
                                    <span>Usuários</span>
                                </Button>
                                <Button 
                                    className={`menu-btn ${abaAtiva === "permissoes" ? "active" : ""}`}
                                    onClick={() => setAbaAtiva("permissoes")}
                                >
                                    <IoMdSettings />
                                    <span>Gerenciar Permissões</span>
                                </Button>
                                <Button 
                                    className={`menu-btn ${abaAtiva === "contratantes" ? "active" : ""}`}
                                    onClick={() => setAbaAtiva("contratantes")}
                                >
                                    <GrUserManager />
                                    <span>Contratantes</span>
                                </Button>
                                <Button 
                                    className={`menu-btn ${abaAtiva === "planocontas" ? "active" : ""}`}
                                    onClick={() => setAbaAtiva("planocontas")}
                                >
                                    <GrPlan />
                                    <span>Plano de Contas</span>
                                </Button>
                                <Button 
                                    className={`menu-btn ${abaAtiva === "lotes" ? "active" : ""}`}
                                    onClick={() => setAbaAtiva("lotes")}
                                >
                                    <BiImport />
                                    <span>Lotes de Importações</span>
                                </Button>
                                <Button 
                                    className={`menu-btn ${abaAtiva === "logs" ? "active" : ""}`}
                                    onClick={() => setAbaAtiva("logs")}
                                >
                                    <FaHistory />
                                    <span>Logs</span>
                                </Button>
                            </>
                        )}

                        <Button className="menu-btn logout" onClick={handleLogout}>
                            <CiLogout />
                            <span>Sair</span>
                        </Button>
                    </div>
                </Card>
            </aside>

            {/* CONTEÚDO PRINCIPAL */}
            <main className="page-main-content">
                {abaAtiva === "perfil" && <PerfilTab usuario={usuario} />}

                {abaAtiva === "usuarios" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <UsuariosTab 
                        usuario={usuario}
                        setUsuario={setUsuario}
                        token={token} 
                        usuarios={usuarios} 
                        contratantes={contratantes} 
                        carregarUsuarios={carregarUsuarios}
                    />
                )}

                {abaAtiva === "permissoes" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <PermissoesTab 
                        token={token} 
                        usuarios={usuarios} 
                        contratantes={contratantes} 
                    />
                )}

                {abaAtiva === "contratantes" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <ContratantesTab 
                        token={token} 
                        contratantes={contratantes} 
                        carregarContratantes={carregarContratantes} 
                    />
                )}

                {abaAtiva === "planocontas" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <PlanoContasTab 
                        token={token} 
                        banco={banco} 
                    />
                )}

                {abaAtiva === "lotes" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <LotesTab 
                        token={token}
                        banco={banco}
                        lotes={lotes}
                        carregandoLotes={carregandoLotes}
                        carregarLotes={carregarLotes}
                    />
                )}

                {abaAtiva === "logs" && (usuario?.perfil === 1 || usuario?.id === 1) && (
                    <LogsTab token={token} />
                )}
            </main>
        </div>
    );
}