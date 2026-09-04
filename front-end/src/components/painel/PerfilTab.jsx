import React from "react";
import Card from "../card/Card";

// Mapeamento dos IDs de perfil para os nomes amigáveis
const nomesPerfis = {
    1: "Administrador",
    2: "Funcionário",
    3: "Cliente"
};

export default function PerfilTab({ usuario }) {
    const ehSupremo = Number(usuario?.id) === 1 || Number(usuario?.protegido) === 1;
    const perfilId = Number(usuario?.perfil);

    return (
        <Card title="Meu Perfil">
            <div className="perfil-info">
                <p>
                    <strong>Nome:</strong> {usuario?.nome}
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
            </div>
        </Card>
    );
}