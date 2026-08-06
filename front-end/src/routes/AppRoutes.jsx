import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import LoginPage from "../pages/LoginPage";
import SimulatorPage from "../pages/SimulatorPage";
import ValuationPage from "../pages/ValuationPage";
import DREPage from "../pages/DREPage";
import FluxoCaixaPage from "../pages/FluxoCaixaPage";
import FolhaPagamentoPage from "../pages/FolhaPagamentoPage";
import ReceitaPage from "../pages/ReceitaPage";
import CustosPage from "../pages/CustosPage";
import BalancoPage from "../pages/BalancoPage";
import BasePage from "../pages/BasePage"
import ImportacaoPage from "../pages/ImportacaoPage"
import ConversorPage from "../pages/ConversorPage";
import RotaProtegida from "../components/RotaProtegida";
import PainelControlePage from "../pages/PainelControlePage"

export default function AppRoutes() {
    return (
        <Routes>

            <Route path="/" element={<Layout />}>

                {/* Login fica livre, sem RotaProtegida */}
                <Route index element={<LoginPage />} />
                <Route path="login" element={<LoginPage />} />

                {/* Rotas que exigem apenas estar logado (qualquer perfil) */}
                <Route path="simulator" element={
                    <RotaProtegida><SimulatorPage /></RotaProtegida>
                } />
                <Route path="valuation" element={
                    <RotaProtegida><ValuationPage /></RotaProtegida>
                } />
                <Route path="dre" element={
                    <RotaProtegida><DREPage /></RotaProtegida>
                } />
                <Route path="fluxocaixa" element={
                    <RotaProtegida><FluxoCaixaPage /></RotaProtegida>
                } />
                <Route path="folhapagamento" element={
                    <RotaProtegida><FolhaPagamentoPage /></RotaProtegida>
                } />
                <Route path="receita" element={
                    <RotaProtegida><ReceitaPage /></RotaProtegida>
                } />
                <Route path="custos" element={
                    <RotaProtegida><CustosPage /></RotaProtegida>
                } />
                <Route path="balanco" element={
                    <RotaProtegida><BalancoPage /></RotaProtegida>
                } />
                <Route path="painel-controle" element={
                    <RotaProtegida><PainelControlePage /></RotaProtegida>
                } />

                {/* Importação: só Admin (1) e Funcionário (2) — Cliente não pode acessar */}
                <Route path="base" element={
                    <RotaProtegida perfisPermitidos={[1, 2]}><BasePage /></RotaProtegida>
                } />
                <Route path="conversor" element={
                    <RotaProtegida perfisPermitidos={[1, 2]}><ConversorPage /></RotaProtegida>
                } />
                <Route path="importacao" element={
                    <RotaProtegida perfisPermitidos={[1]}><ImportacaoPage /></RotaProtegida>
                } />

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
    );
}