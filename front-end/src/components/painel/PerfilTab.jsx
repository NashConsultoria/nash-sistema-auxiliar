import React from "react";
import Card from "../card/Card";
//import { nomesPerfis } from "../../constants/perfis";

export default function PerfilTab({ usuario }) {
    const ehSupremo = Number(usuario?.id) === 1 || Number(usuario?.protegido) === 1;
    const perfilId = Number(usuario?.perfil);

    return (
        <Card title="Meu Perfil">
            <div className="perfil-info">
                <p>
                    <strong>Nome:</strong> {usuario?.nome || "Administrador Supremo"}
                </p>
                {usuario?.email && (
                    <p>
                        <strong>E-mail:</strong> {usuario.email}
                    </p>
                )}
                <p>
                    <strong>Nível de Acesso:</strong>{" "}
                    {ehSupremo
                        ? "Administrador Supremo"
                        : (nomesPerfis[perfilId] || "Não Identificado")}
                </p>
                <p>
                    <strong>Contratante:</strong>{" "}
                    {perfilId === 3 
                        ? (usuario?.nome_contratante || "Não Vinculado") 
                        : "N/A"
                    }
                </p>
            </div>
        </Card>
    );
}