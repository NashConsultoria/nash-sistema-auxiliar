import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../components/PainelControle.css"; 
import Card from "../components/card/Card";
import Button from "../components/button/Button";

import PerfilTab from "../components/painel/PerfilTab";
import UsuariosTab from "../components/painel/UsuariosTab";
import PermissoesTab from "../components/painel/PermissoesTab";
import ContratantesTab from "../components/painel/ContratantesTab";
import UnidadesTab from "../components/painel/UnidadesTab";
import BancosTab from "../components/painel/BancosTab";
import PlanoContasTab from "../components/painel/PlanoContasTab";
import LotesTab from "../components/painel/LotesTab";
import LogsTab from "../components/painel/LogsTab";

import { API_BASE, useAuth } from "../context/AuthContext";

import { CiLogout, CiBank } from "react-icons/ci";
import { FaUsers } from "react-icons/fa6";
import { FaUser, FaHistory, FaBuilding } from "react-icons/fa";
import { IoMdSettings } from "react-icons/io";
import { GrUserManager, GrPlan } from "react-icons/gr";
import { BiImport } from "react-icons/bi";

export default function PainelControle() {
    const navigate = useNavigate();
    const { logout, usuario, setUsuario, token } = useAuth();
    const banco = usuario?.banco || "NashBancoConsultoria";

    const [abaAtiva, setAbaAtiva] = useState("perfil");
    const [contratantes, setContratantes] = useState([]);
    const [bancos, setBancos] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [carregandoLotes, setCarregandoLotes] = useState(false);

    // ==========================================================
    // HELPER DE PERMISSÃO
    // ==========================================================
    const temAcesso = (...perfisPermitidos) => {
        if (!usuario) return false;
        return Boolean(usuario.protegido) || perfisPermitidos.includes(usuario.perfil);
    };

    // ==========================================================
    // CARREGAMENTO DE DADOS
    // ==========================================================
    const carregarContratantes = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/contratantes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar contratantes");
            setContratantes(await res.json());
        } catch (err) {
            console.error("Erro contratantes:", err);
        }
    };

    const carregarBancos = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/bancos`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar bancos");
            setBancos(await res.json());
        } catch (err) {
            console.error("Erro bancos:", err);
        }
    };

    const carregarUsuarios = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/usuarios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Erro ao buscar usuários");
            setUsuarios(await res.json());
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
            if (dados.sucesso) setLotes(dados.lotes);
        } catch (err) {
            console.error("Erro lotes:", err);
        } finally {
            setCarregandoLotes(false);
        }
    };

    useEffect(() => {
        if (temAcesso(1, 2)) {
            carregarBancos();
        }
        if (temAcesso(1)) {
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

    // ==========================================================
    // CONFIGURAÇÃO DAS ABAS / PERMISSÕES
    // ==========================================================
    const menuItems = [
        {
            id: "perfil",
            label: "Perfil",
            icon: <FaUser />,
            perfis: [1, 2, 3],
            component: <PerfilTab usuario={usuario} />
        },
        {
            id: "usuarios",
            label: "Usuários",
            icon: <FaUsers />,
            perfis: [1],
            component: (
                <UsuariosTab 
                    usuario={usuario}
                    setUsuario={setUsuario}
                    token={token} 
                    usuarios={usuarios} 
                    contratantes={contratantes} 
                    carregarUsuarios={carregarUsuarios}
                />
            )
        },
        {
            id: "permissoes",
            label: "Gerenciar Permissões",
            icon: <IoMdSettings />,
            perfis: [1],
            component: (
                <PermissoesTab 
                    token={token} 
                    usuarios={usuarios} 
                    contratantes={contratantes} 
                />
            )
        },
        {
            id: "contratantes",
            label: "Contratantes",
            icon: <GrUserManager />,
            perfis: [1],
            component: (
                <ContratantesTab 
                    token={token} 
                    contratantes={contratantes} 
                    carregarContratantes={carregarContratantes} 
                />
            )
        },
        {
            id: "unidades",
            label: "Unidades",
            icon: <FaBuilding />,
            perfis: [1, 2],
            component: (
                <UnidadesTab 
                    token={token} 
                    contratantes={contratantes} 
                    carregarContratantes={carregarContratantes} 
                />
            )
        },
        {
            id: "bancos",
            label: "Bancos",
            icon: <CiBank />,
            perfis: [1, 2],
            component: (
                <BancosTab 
                    token={token} 
                    bancos={bancos} 
                    carregarBancos={carregarBancos} 
                />
            )
        },
        {
            id: "planocontas",
            label: "Plano de Contas",
            icon: <GrPlan />,
            perfis: [1, 2],
            component: (
                <PlanoContasTab 
                    token={token} 
                    banco={banco} 
                />
            )
        },
        {
            id: "lotes",
            label: "Lotes de Importações",
            icon: <BiImport />,
            perfis: [1],
            component: (
                <LotesTab 
                    token={token}
                    banco={banco}
                    lotes={lotes}
                    carregandoLotes={carregandoLotes}
                    carregarLotes={carregarLotes}
                />
            )
        },
        {
            id: "logs",
            label: "Logs",
            icon: <FaHistory />,
            perfis: [1], 
            component: <LogsTab token={token} />
        }
    ];

    // Filtra apenas os itens de menu autorizados para o usuário logado
    const menuAutorizado = menuItems.filter(item => temAcesso(...item.perfis));
    const abaAtualObj = menuAutorizado.find(item => item.id === abaAtiva);

    return (
        <div className="usuario-page-layout">
            {/* SIDEBAR */}
            <aside className="page-sidebar">
                <Card title="Painel de Controle">
                    <div className="sidebar-menu">
                        {menuAutorizado.map((item) => (
                            <Button 
                                key={item.id}
                                className={`menu-btn ${abaAtiva === item.id ? "active" : ""}`}
                                onClick={() => setAbaAtiva(item.id)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Button>
                        ))}

                        <Button className="menu-btn logout" onClick={handleLogout}>
                            <CiLogout />
                            <span>Sair</span>
                        </Button>
                    </div>
                </Card>
            </aside>

            {/* CONTEÚDO PRINCIPAL */}
            <main className="page-main-content">
                {abaAtualObj ? abaAtualObj.component : menuAutorizado[0]?.component}
            </main>
        </div>
    );
}