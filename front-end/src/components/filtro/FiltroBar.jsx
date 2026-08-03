import React from "react";
import Card from "../card/Card";
import Button from "../button/Button";

export default function FiltroBar({
    contratanteSel,
    setContratanteSel,
    contratantes = [],
    unidadeSel,
    setUnidadeSel,
    unidades = [],
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    desabilitarContratante = false,
    acoesAdicionais,
    datalistSuffix = "default"
}) {
    return (
        <div className="no-print">
            <Card title="Filtros de Pesquisa">
                <div className="filtro-bar-container">
                    {/* 1. FILTRO DE CONTRATANTE */}
                    <div className="filtro-campo">
                        <label>Contratante:</label>
                        <input
                            type="text"
                            list={`list-contratantes-${datalistSuffix}`}
                            className="filtro-input filtro-input-text"
                            placeholder="Digite para buscar..."
                            disabled={desabilitarContratante}
                            value={contratanteSel}
                            onChange={(e) => {
                                const valorDigitado = e.target.value;
                                setContratanteSel(valorDigitado);
                                if (!valorDigitado && setUnidadeSel) {
                                    setUnidadeSel("");
                                }
                            }}
                        />
                        <datalist id={`list-contratantes-${datalistSuffix}`}>
                            {contratantes.map((c) => (
                                <option key={c.id} value={c.nome} />
                            ))}
                        </datalist>
                    </div>

                    {/* 2. FILTRO DE UNIDADE */}
                    {setUnidadeSel && (
                        <div className="filtro-campo">
                            <label>Unidade:</label>
                            <input
                                type="text"
                                list={`list-unidades-${datalistSuffix}`}
                                className="filtro-input filtro-input-text"
                                placeholder={!contratanteSel ? "Selecione um contratante..." : "Digite a unidade..."}
                                disabled={!contratanteSel}
                                value={unidadeSel}
                                onChange={(e) => setUnidadeSel(e.target.value)}
                            />
                            <datalist id={`list-unidades-${datalistSuffix}`}>
                                {unidades.map((u) => (
                                    <option key={u.id} value={u.nome} />
                                ))}
                            </datalist>
                        </div>
                    )}

                    {/* 3. FILTRO DE DATA INÍCIO */}
                    {setDataInicio && (
                        <div className="filtro-campo">
                            <label>Data Início:</label>
                            <input
                                type="date"
                                className="filtro-input"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                            />
                        </div>
                    )}

                    {/* 4. FILTRO DE DATA FIM */}
                    {setDataFim && (
                        <div className="filtro-campo">
                            <label>Data Fim:</label>
                            <input
                                type="date"
                                className="filtro-input"
                                value={dataFim}
                                onChange={(e) => setDataFim(e.target.value)}
                            />
                        </div>
                    )}

                    {/* BOTÕES / AÇÕES ADICIONAIS DE CADA PÁGINA */}
                    {acoesAdicionais && (
                        <div className="filtro-acoes">
                            {acoesAdicionais}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}