import { useState, useMemo, useEffect } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import Table from "../table/Table";
import FiltroBar from "../filtro/FiltroBar";
import Inputlist from "../Inputlist/Inputlist";
import { API_BASE } from "../../context/AuthContext";

// Mapeamento dos Tipos de Unidade
const TIPOS_UNIDADE = {
    1: "Registro",
    2: "Atuação",
    3: "Ambos"
};

export default function UnidadesTab({ 
    token, 
    unidades = [], 
    carregarUnidades,
}) {
    const [modoCadastroUnidade, setModoCadastroUnidade] = useState(false);
    const [editandoUnidadeId, setEditandoUnidadeId] = useState(null);
    const [mostrarInativos, setMostrarInativos] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [formUnidade, setFormUnidade] = useState({ 
        nome: "", 
        razaoSocial: "", 
        cnpj: "", 
        contratanteId: "", 
        tipo: 1 
    });

    // ESTADOS DO CONTRATANTE
    const [contratantes, setContratantes] = useState([]);
    const [contratanteTexto, setContratanteTexto] = useState("");

    useEffect(() => {
        carregarContratantes();
    }, []);
    
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

    // --- ESTADOS DO FILTROBAR ---
    const [filtros, setFiltros] = useState({
        nome: '',
        razaoSocial: '',
        cnpj: '',
        contratanteId: '',
        tipo: ''
    });

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }));
    };

    const limparFiltros = () => {
        setFiltros({
            nome: '',
            razaoSocial: '',
            cnpj: '',
            contratanteId: '',
            tipo: ''
        });
    };

    // --- LÓGICA DE FILTRAGEM DINÂMICA ---
    const filtrarUnidadesExcecao = (chaveIgnorada) => {
        return unidades.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const razao = (item.razaoSocial || '').toLowerCase();
            const cnpj = (item.cnpj || '').toLowerCase();
            const contratanteId = String(item.contratanteId || '');
            const tipo = String(item.tipo || '');

            return (
                passaStatus &&
                (chaveIgnorada === 'nome' || nome.includes(filtros.nome.toLowerCase().trim())) &&
                (chaveIgnorada === 'razaoSocial' || razao.includes(filtros.razaoSocial.toLowerCase().trim())) &&
                (chaveIgnorada === 'cnpj' || cnpj.includes(filtros.cnpj.toLowerCase().trim())) &&
                (chaveIgnorada === 'contratanteId' || !filtros.contratanteId || contratanteId === String(filtros.contratanteId)) &&
                (chaveIgnorada === 'tipo' || !filtros.tipo || tipo === String(filtros.tipo))
            );
        });
    };

    const opcoesNome = useMemo(() => {
        const dados = filtrarUnidadesExcecao('nome');
        return Array.from(new Set(dados.map(u => u.nome).filter(Boolean)));
    }, [unidades, filtros, mostrarInativos]);

    const opcoesRazao = useMemo(() => {
        const dados = filtrarUnidadesExcecao('razaoSocial');
        return Array.from(new Set(dados.map(u => u.razaoSocial).filter(Boolean)));
    }, [unidades, filtros, mostrarInativos]);

    const opcoesContratantes = useMemo(() => {
        return contratantes.map(c => c.nome || c.razaoSocial).filter(Boolean);
    }, [contratantes]);

    const opcoesCnpj = useMemo(() => {
        const dados = filtrarUnidadesExcecao('cnpj');
        return Array.from(new Set(dados.map(u => u.cnpj).filter(Boolean)));
    }, [unidades, filtros, mostrarInativos]);

    // Sincroniza o texto do Inputlist com o contratanteId correspondente
    const handleContratanteChange = (valorTexto) => {
        const texto = typeof valorTexto === 'object' ? valorTexto.target?.value || '' : valorTexto;
        setContratanteTexto(texto);

        const encontrado = contratantes.find(
            c => (c.nome || c.razaoSocial || "").toLowerCase() === texto.toLowerCase().trim()
        );

        setFormUnidade(prev => ({
            ...prev,
            contratanteId: encontrado ? encontrado.id : ""
        }));
    };

    const schemaFiltroUnidade = [
        {
            key: "nome",
            label: "Nome Fantasia",
            tipo: "inputlist",
            placeholder: "Buscar por Nome...",
            options: opcoesNome
        },
        {
            key: "razaoSocial",
            label: "Razão Social",
            tipo: "inputlist",
            placeholder: "Buscar por Razão...",
            options: opcoesRazao
        },
        {
            key: "contratanteId",
            label: "Contratante",
            tipo: "inputlist",
            placeholder: "Buscar por Contratante...",
            options: opcoesContratantes
        },
        {
            key: "cnpj",
            label: "CNPJ",
            tipo: "inputlist",
            placeholder: "Buscar por CNPJ...",
            options: opcoesCnpj
        },
        {
            key: "tipo",
            label: "Tipo",
            tipo: "select",
            options: [
                { value: "", label: "Todos" },
                { value: "1", label: "Registro" },
                { value: "2", label: "Atuação" },
                { value: "3", label: "Ambos" }
            ]
        }
    ];

    const unidadesFiltradas = useMemo(() => {
        return unidades.filter((item) => {
            const passaStatus = mostrarInativos ? true : Number(item.status) === 1;
            const nome = (item.nome || '').toLowerCase();
            const razao = (item.razaoSocial || '').toLowerCase();
            const cnpj = (item.cnpj || '').toLowerCase();
            const tipo = String(item.tipo || '');

            // Busca o nome do contratante atrelado à unidade para comparar com o filtro
            const contratanteDaUnidade = contratantes.find(c => Number(c.id) === Number(item.contratanteId));
            const nomeContratante = (contratanteDaUnidade?.nome || contratanteDaUnidade?.razaoSocial || '').toLowerCase();

            return (
                passaStatus &&
                nome.includes(filtros.nome.toLowerCase().trim()) &&
                razao.includes(filtros.razaoSocial.toLowerCase().trim()) &&
                cnpj.includes(filtros.cnpj.toLowerCase().trim()) &&
                (!filtros.contratanteId || nomeContratante.includes(filtros.contratanteId.toLowerCase().trim())) &&
                (!filtros.tipo || tipo === String(filtros.tipo))
            );
        });
    }, [unidades, filtros, mostrarInativos, contratantes]);

    // --- SALVAR (CRIAR / ATUALIZAR) ---
    const handleSalvarUnidade = async (e) => {
        e.preventDefault();

        if (!formUnidade.nome.trim()) {
            alert("O Nome da Unidade é obrigatório.");
            return;
        }

        if (!formUnidade.contratanteId) {
            alert("Selecione um Contratante válido da lista.");
            return;
        }

        setCarregando(true);

        const url = editandoUnidadeId 
            ? `${API_BASE}/api/unidades/${editandoUnidadeId}` 
            : `${API_BASE}/api/unidades`;
            
        const metodo = editandoUnidadeId ? "PUT" : "POST";

        const payload = {
            nome: formUnidade.nome.trim(),
            razaoSocial: formUnidade.razaoSocial.trim() || null,
            cnpj: formUnidade.cnpj.trim() || null,
            contratanteId: formUnidade.contratanteId ? Number(formUnidade.contratanteId) : null,
            tipo: Number(formUnidade.tipo) || 1
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
            if (!res.ok) throw new Error(resposta.detail || "Erro ao salvar unidade.");

            alert("Unidade salva com sucesso!");
            setModoCadastroUnidade(false);
            if (carregarUnidades) carregarUnidades();
        } catch (err) {
            alert(err.message);
        } finally {
            setCarregando(false);
        }
    };

    const handleIniciarEdicaoUnidade = (unidade) => {
        const contratanteEncontrado = contratantes.find(c => Number(c.id) === Number(unidade.contratanteId));
        
        setFormUnidade({
            nome: unidade.nome || "",
            razaoSocial: unidade.razaoSocial || "",
            cnpj: unidade.cnpj || "",
            contratanteId: unidade.contratanteId || "",
            tipo: unidade.tipo || 1
        });
        
        setContratanteTexto(contratanteEncontrado ? (contratanteEncontrado.nome || contratanteEncontrado.razaoSocial) : "");
        setEditandoUnidadeId(unidade.id);
        setModoCadastroUnidade(true);
    };

    const handleAlternarStatusUnidade = async (unidade) => {
        const isAtivo = Number(unidade.status) === 1;
        const confirmacao = window.confirm(`Deseja realmente ${isAtivo ? "desativar" : "reativar"} a unidade "${unidade.nome}"?`);
        if (!confirmacao) return;

        try {
            const res = await fetch(`${API_BASE}/api/unidades/${unidade.id}/status?ativo=${!isAtivo}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });

            const resposta = await res.json();
            if (!res.ok) throw new Error(resposta.detail || "Erro ao alterar status da unidade.");

            alert(resposta.mensagem || "Status atualizado com sucesso!");
            if (carregarUnidades) carregarUnidades();
        } catch (err) {
            alert(err.message);
        }
    };

    const colunasUnidades = [
        {
            label: "Contratante",
            key: "contratanteId",
            width: "18%",
            Cell: ({ row }) => {
                const contratante = contratantes.find(c => Number(c.id) === Number(row.contratanteId));
                return contratante ? (contratante.nome || contratante.razaoSocial) : "-";
            }
        },
        {
            label: "Nome Fantasia",
            key: "nome",
            width: "25%",
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
            width: "25%",
            Cell: ({ row }) => row.razaoSocial || "-"
        },
        {
            label: "CNPJ",
            key: "cnpj",
            width: "18%",
            Cell: ({ row }) => row.cnpj || "-"
        },
        {
            label: "Tipo",
            key: "tipo",
            width: "12%",
            Cell: ({ row }) => TIPOS_UNIDADE[row.tipo] || "Não Informado"
        },
        {
            label: "Ações",
            key: "acoes",
            width: "20%",
            style: { textAlign: "center" },
            Cell: ({ row }) => {
                const isAtivo = Number(row.status) === 1;
                return (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Button onClick={() => handleIniciarEdicaoUnidade(row)}>
                            Editar
                        </Button>
                        <Button
                            onClick={() => handleAlternarStatusUnidade(row)}
                            style={{
                                backgroundColor: isAtivo ? "#ef444422" : "#22c55e22",
                                color: isAtivo ? "#f87171" : "#4ade80",
                            }}
                        >
                            {isAtivo ? "Inativar" : "Reativar"}
                        </Button>
                    </div>
                );
            }
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!modoCadastroUnidade ? (
                <Card title="Gerenciamento de Unidades">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <p>Visualize e gerencie as unidades cadastradas no sistema.</p>
                            <Button
                                onClick={() => setMostrarInativos(!mostrarInativos)}
                                style={{
                                    backgroundColor: mostrarInativos ? "#ef4444" : "#35448a",
                                }}
                            >
                                {mostrarInativos ? "Ver Apenas Ativas" : "Mostrar Inativas"}
                            </Button>
                        </div>
                        <Button
                            onClick={() => {
                                setEditandoUnidadeId(null);
                                setFormUnidade({ nome: "", razaoSocial: "", cnpj: "", contratanteId: "", tipo: 1 });
                                setContratanteTexto("");
                                setModoCadastroUnidade(true);
                            }}
                        >
                            + Cadastrar Nova Unidade
                        </Button>
                    </div>

                    <div className="card-filtros mb-4">
                        <div className="form-row">
                            <FiltroBar
                                schema={schemaFiltroUnidade}
                                filtros={filtros}
                                onChange={handleFilterChange}
                                onLimpar={limparFiltros}
                            />
                        </div>
                    </div>

                    <Table
                        columns={colunasUnidades}
                        data={unidadesFiltradas}
                        getRowClassName={(row) => Number(row.status) === 2 ? "usuario-inativo" : ""}
                    />
                </Card>
            ) : (
                <Card title={editandoUnidadeId ? "Editar Unidade" : "Cadastrar Nova Unidade"}>
                    <form onSubmit={handleSalvarUnidade} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                        
                        <div className="form-group">
                            <label className="form-label">Nome Fantasia *</label>
                            <input
                                type="text"
                                className="form-input"
                                required
                                value={formUnidade.nome}
                                onChange={(e) => setFormUnidade({ ...formUnidade, nome: e.target.value })}
                                placeholder="Ex: Unidade Matriz, Filial SP"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Razão Social</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formUnidade.razaoSocial}
                                onChange={(e) => setFormUnidade({ ...formUnidade, razaoSocial: e.target.value })}
                                placeholder="Ex: Empresa de Serviços LTDA"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">CNPJ</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formUnidade.cnpj}
                                onChange={(e) => setFormUnidade({ ...formUnidade, cnpj: e.target.value })}
                                placeholder="00.000.000/0000-00"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Contratante *</label>
                            <Inputlist
                                id="contratante"
                                placeholder="Pesquisar contratante para adicionar..."
                                options={opcoesContratantes}
                                value={contratanteTexto}
                                onChange={handleContratanteChange}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tipo de Unidade *</label>
                            <select
                                className="form-input"
                                required
                                value={formUnidade.tipo}
                                onChange={(e) => setFormUnidade({ ...formUnidade, tipo: e.target.value })}
                            >
                                <option value={1}>Registro</option>
                                <option value={2}>Atuação</option>
                                <option value={3}>Ambos</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "10px", justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                onClick={() => setModoCadastroUnidade(false)}
                                disabled={carregando}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={carregando}>
                                {carregando ? "Salvando..." : "Salvar Unidade"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}