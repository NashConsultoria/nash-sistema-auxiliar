import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import Login from "../pages/Login";
import Simulator from "../pages/Simulator";
import Valuation from "../pages/Valuation";
import DRE from "../pages/DRE";
import FluxoCaixa from "../pages/FluxoCaixa";
import FolhaPagamento from "../pages/FolhaPagamento";
import Receita from "../pages/Receita";
import Custos from "../pages/Custos";
import Balanco from "../pages/Balanco";
import BaseFinanceira from "../pages/BaseFinanceira"
import BaseFolha from "../pages/BaseFolha"
import BaseFluxoCaixa from "../pages/BaseFluxoCaixa"
import Importacao from "../pages/Importacao"
import Conversor from "../pages/Conversor";
import RotaProtegida from "../components/RotaProtegida";
import PainelControle from "../pages/PainelControle"
import VDRE from "../pages/VDRE";

export default function AppRoutes() {
    return (
        <Routes>

            <Route path="/" element={<Layout />}>

                {/* Login fica livre, sem RotaProtegida */}
                <Route index element={<Login />} />
                <Route path="login" element={<Login />} />

                {/* Rotas que exigem apenas estar logado (qualquer perfil) */}
                <Route path="simulator" element={
                    <RotaProtegida><Simulator /></RotaProtegida>
                } />
                <Route path="valuation" element={
                    <RotaProtegida><Valuation /></RotaProtegida>
                } />
                <Route path="dre" element={
                    <RotaProtegida><DRE /></RotaProtegida>
                } />
                <Route path="fluxo-caixa" element={
                    <RotaProtegida><FluxoCaixa /></RotaProtegida>
                } />
                <Route path="folha-pagamento" element={
                    <RotaProtegida><FolhaPagamento /></RotaProtegida>
                } />
                <Route path="receita" element={
                    <RotaProtegida><Receita /></RotaProtegida>
                } />
                <Route path="custos" element={
                    <RotaProtegida><Custos /></RotaProtegida>
                } />
                <Route path="balanco" element={
                    <RotaProtegida><Balanco /></RotaProtegida>
                } />
                <Route path="valuation-dre" element={
                    <RotaProtegida><VDRE /></RotaProtegida>
                } />
                <Route path="painel-controle" element={
                    <RotaProtegida><PainelControle /></RotaProtegida>
                } />

                {/* Importação: só Admin (1) e Funcionário (2) — Cliente não pode acessar */}
                <Route path="base-financeira" element={
                    <RotaProtegida perfisPermitidos={[1, 2]}><BaseFinanceira /></RotaProtegida>
                } />
                <Route path="base-folha" element={
                    <RotaProtegida perfisPermitidos={[1, 2]}><BaseFolha /></RotaProtegida>
                } />
                <Route path="base-fluxo-caixa" element={
                    <RotaProtegida perfisPermitidos={[1, 2]}><BaseFluxoCaixa /></RotaProtegida>
                } />
                <Route path="conversor" element={
                    <RotaProtegida perfisPermitidos={[1, 2]}><Conversor /></RotaProtegida>
                } />
                <Route path="importacao" element={
                    <RotaProtegida perfisPermitidos={[1]}><Importacao /></RotaProtegida>
                } />

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
    );
}