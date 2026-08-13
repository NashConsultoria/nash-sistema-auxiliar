import { useState } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import { API_BASE } from "../../context/AuthContext";

export default function ContratantesTab({ token, contratantes = [], carregarContratantes }) {
    const [modoCadastroContratante, setModoCadastroContratante] = useState(false);
    const [editandoContratanteId, setEditandoContratanteId] = useState(null);
    const [mostrarContratantesInativos, setMostrarContratantesInativos] = useState(false);
    const [formContratante, setFormContratante] = useState({ nome: "", razaoSocial: "" });
    const [carregando, setCarregando] = useState(false);

    const handleSalvarContratante = async (e) => {
        e.preventDefault();

        // Validação básica: apenas Nome é obrigatório
        if (!formContratante.nome.trim()) {
            alert("O Nome do Contratante é obrigatório.");
            return;
        }

        setCarregando(true);

        const url = editandoContratanteId 
            ? `${API_BASE}/api/contratantes/${editandoContratanteId}` 
            : `${API_BASE}/api/contratantes`;
            
        const metodo = editandoContratanteId ? "PUT" : "POST";

        const statusAtual = editandoContratanteId
            ? Number(contratantes.find(c => c.id === editandoContratanteId)?.status || 1)
            : 1;

        const payload = {
            nome: formContratante.nome.trim(),
            razaoSocial: formContratante.razaoSocial?.trim() ? formContratante.razaoSocial.trim() : null,
            status: statusAtual
        };

        try {
            const res = await fetch(url, {
                method: metodo,
                headers: { 
                    "Content-Type": "application/json", 
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });
            
            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar contratante.");

            alert("Contratante salvo com sucesso!");
            setModoCadastroContratante(false);
            if (carregarContratantes) carregarContratantes(); // Recarrega a listagem
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const handleIniciarEdicaoContratante = (contratante) => {
        setFormContratante({
            nome: contratante.nome || "",
            // Trata fallback para caso o backend envie snake_case (razao_social)
            razaoSocial: contratante.razaoSocial || contratante.razao_social || ""
        });
        setEditandoContratanteId(contratante.id);
        setModoCadastroContratante(true);
    };

    const handleAlternarStatusContratante = async (contratante) => {
        const isAtivo = Number(contratante.status) === 1;
        const confirmacao = window.confirm(`Deseja realmente ${isAtivo ? "desativar" : "reativar"} o contratante "${contratante.nome}"?`);
        if (!confirmacao) return;

        try {
            const res = await fetch(`${API_BASE}/api/contratantes/${contratante.id}`, {
                method: isAtivo ? "DELETE" : "PUT",
                headers: {
                    ...(!isAtivo && { "Content-Type": "application/json" }),
                    Authorization: `Bearer ${token}`
                },
                ...(!isAtivo && { body: JSON.stringify({ ...contratante, status: 1 }) })
            });
            if (!res.ok) throw new Error("Erro ao alterar status do contratante.");

            alert("Status atualizado!");
            if (carregarContratantes) carregarContratantes();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasContratantes = [
        {
            label: "Nome do Contratante",
            key: "nome",
            width: "50%",
            Cell: ({ row }) => (
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontWeight: "500" }}>{row.nome}</span>
                    {Number(row.status) === 2 && (
                        <span style={{
                            fontSize: "11px", 
                            backgroundColor: "#ef4444", 
                            color: "#fff",
                            padding: "2px 6px", 
                            borderRadius: "4px", 
                            marginLeft: "8px", 
                            fontWeight: "600"
                        }}>
                            Inativo
                        </span>
                    )}
                </div>
            )
        },
        {
            label: "Razão Social",
            key: "razaoSocial",
            width: "30%",
            Cell: ({ row }) => row.razaoSocial || row.razao_social || "-"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "right" },
            Cell: ({ row }) => (
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <Button onClick={() => handleIniciarEdicaoContratante(row)}>
                        Editar
                    </Button>
                    <Button
                        onClick={() => handleAlternarStatusContratante(row)}
                        style={{
                            backgroundColor: Number(row.status) === 1 ? "#ef444422" : "#22c55e22",
                            color: Number(row.status) === 1 ? "#f87171" : "#4ade80",
                        }}
                    >
                        {Number(row.status) === 1 ? "Inativar" : "Reativar"}
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastroContratante ? (
                /* TELA 1: LISTAGEM DE CONTRATANTES */
                <Card title="Gerenciamento de Contratantes">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p style={{ margin: 0 }}>Visualize e gerencie as empresas contratantes cadastradas no sistema.</p>
                            <Button
                                onClick={() => setMostrarContratantesInativos(!mostrarContratantesInativos)}
                                style={{
                                    backgroundColor: mostrarContratantesInativos ? "#ef4444" : "#35448a",
                                }}
                            >
                                {mostrarContratantesInativos ? "Ver Apenas Ativos" : "Mostrar Inativos"}
                            </Button>
                        </div>
                        <Button
                            onClick={() => {
                                setEditandoContratanteId(null);
                                setFormContratante({ nome: "", razaoSocial: "" });
                                setModoCadastroContratante(true);
                            }}
                        >
                            + Cadastrar Novo Contratante
                        </Button>
                    </div>
                    <Table
                        columns={colunasContratantes}
                        data={contratantes.filter((c) => mostrarContratantesInativos ? true : Number(c.status) === 1)}
                        getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                    />
                </Card>
            ) : (
                /* TELA 2: FORMULÁRIO DE CADASTRO/EDIÇÃO DE CONTRATANTE */
                <Card title={editandoContratanteId ? "Editar Contratante" : "Cadastrar Novo Contratante"}>
                    <form onSubmit={handleSalvarContratante} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontWeight: "500" }}>Nome do Contratante *</label>
                            <input
                                type="text"
                                required
                                value={formContratante.nome}
                                onChange={(e) => setFormContratante({ ...formContratante, nome: e.target.value })}
                                placeholder="Ex: NE"
                                style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#35448a", color: "#fff" }}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontWeight: "500" }}>Razão Social:</label>
                            <input
                                type="text"
                                value={formContratante.razaoSocial}
                                onChange={(e) => setFormContratante({ ...formContratante, razaoSocial: e.target.value })}
                                placeholder="Ex: NomeEmpresa LTDA"
                                style={{ padding: "10px 12px", borderRadius: "6px", border: "1px solid #475569", backgroundColor: "#35448a", color: "#fff" }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastroContratante(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Contratante"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}