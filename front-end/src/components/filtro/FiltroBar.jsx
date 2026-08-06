import React, { useState, useRef, useEffect } from "react";
import Card from "../card/Card";
import Button from "../button/Button";
import "./FiltroBar.css"

export default function FiltroBar({
    contratanteSel,
    setContratanteSel,
    contratantes = [],
    unidadeSel = [],
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
    const [dropdownAberto, setDropdownAberto] = useState(false);
    const dropdownRef = useRef(null);

    // Garante que unidadeSel seja SEMPRE processado como Array seguro
    const listaUnidadesSelecionadas = Array.isArray(unidadeSel) ? unidadeSel : [];

    // Fecha o dropdown de unidades ao clicar fora
    useEffect(() => {
        function handleClickOut(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownAberto(false);
            }
        }
        document.addEventListener("mousedown", handleClickOut);
        return () => document.removeEventListener("mousedown", handleClickOut);
    }, []);

    const toggleUnidade = (nomeUnidade) => {
        if (!setUnidadeSel) return;
        
        if (listaUnidadesSelecionadas.includes(nomeUnidade)) {
            setUnidadeSel(listaUnidadesSelecionadas.filter((u) => u !== nomeUnidade));
        } else {
            setUnidadeSel([...listaUnidadesSelecionadas, nomeUnidade]);
        }
    };

    const selecionarTodasUnidades = () => {
        if (!setUnidadeSel) return;

        if (listaUnidadesSelecionadas.length === unidades.length && unidades.length > 0) {
            setUnidadeSel([]);
        } else {
            setUnidadeSel(unidades.map((u) => u.nome));
        }
    };

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
                            value={contratanteSel || ""}
                            onChange={(e) => {
                                const valorDigitado = e.target.value;
                                setContratanteSel(valorDigitado);
                                if (!valorDigitado && setUnidadeSel) {
                                    setUnidadeSel([]);
                                }
                            }}
                        />
                        <datalist id={`list-contratantes-${datalistSuffix}`}>
                            {contratantes.map((c) => (
                                <option key={c.id} value={c.nome} />
                            ))}
                        </datalist>
                    </div>

                    {/* 2. FILTRO DE MULTI-SELEÇÃO DE UNIDADES */}
                    {setUnidadeSel && (
                        <div className="filtro-campo" ref={dropdownRef} style={{ position: "relative" }}>
                            <label>Unidades:</label>
                            
                            <button
                                type="button"
                                className="filtro-input filtro-input-text filtro-multiselect-btn"
                                disabled={!contratanteSel}
                                onClick={() => setDropdownAberto(!dropdownAberto)}
                            >
                                {!contratanteSel
                                    ? "Selecione um contratante..."
                                    : listaUnidadesSelecionadas.length === 0
                                    ? "Todas as unidades"
                                    : `${listaUnidadesSelecionadas.length} unidade(s) selecionada(s)`}
                            </button>

                            {/* Dropdown com checkboxes */}
                            {dropdownAberto && contratanteSel && (
                                <div className="multiselect-dropdown">
                                    {unidades.length > 0 && (
                                        <div 
                                            className="multiselect-item multiselect-item-all"
                                            onClick={selecionarTodasUnidades}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={listaUnidadesSelecionadas.length === unidades.length && unidades.length > 0}
                                                readOnly
                                            />
                                            <strong>Selecionar Todas</strong>
                                        </div>
                                    )}

                                    {unidades.map((u) => (
                                        <div 
                                            key={u.id} 
                                            className="multiselect-item"
                                            onClick={() => toggleUnidade(u.nome)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={listaUnidadesSelecionadas.includes(u.nome)}
                                                readOnly
                                            />
                                            <span>{u.nome}</span>
                                        </div>
                                    ))}

                                    {unidades.length === 0 && (
                                        <div className="multiselect-item-empty">Nenhuma unidade encontrada</div>
                                    )}
                                </div>
                            )}
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

                    {/* BOTÕES / AÇÕES ADICIONAIS */}
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