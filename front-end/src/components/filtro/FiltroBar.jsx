import React from "react";
import Button from "../button/Button";
import Inputlist from "../Inputlist/Inputlist";

export default function FiltroBar({ schema = [], filtros = {}, onChange, onLimpar }) {
    return (
        <div className="card-filtros mb-4">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h5 className="m-0">Filtros</h5>
                {onLimpar && (
                    <Button type="button" onClick={onLimpar}>
                        Limpar Filtros
                    </Button>
                )}
            </div>

            <div className="form-row">
                {schema.map((campo) => {
                    const valorAtual = filtros[campo.key] || "";

                    return (
                        <div key={campo.key} className="form-group" style={{ flex: campo.flex || "1 1 200px" }}>
                            {/* RENDERIZAÇÃO SEGUNDO O TIPO DO CAMPO */}
                            {campo.tipo === "inputlist" && (
                                <Inputlist
                                    id={`filtro-${campo.key}`}
                                    label={campo.label}
                                    placeholder={campo.placeholder || `Buscar ${campo.label.toLowerCase()}...`}
                                    value={valorAtual}
                                    onChange={(e) => onChange(campo.key, e.target.value)}
                                    options={campo.options || []}
                                    valueKey={campo.valueKey || ((item) => item)}
                                />
                            )}

                            {campo.tipo === "select" && (
                                <div>
                                    <label className="form-label">{campo.label}</label>
                                    <select
                                        className="form-input"
                                        value={valorAtual}
                                        onChange={(e) => onChange(campo.key, e.target.value)}
                                    >
                                        <option value="">{campo.placeholder || "Todos"}</option>
                                        {campo.options.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {campo.tipo === "text" && (
                                <div>
                                    <label className="form-label">{campo.label}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={campo.placeholder || `Filtrar por ${campo.label.toLowerCase()}...`}
                                        value={valorAtual}
                                        onChange={(e) => onChange(campo.key, e.target.value)}
                                    />
                                </div>
                            )}

                            {campo.tipo === "date" && (
                                <div>
                                    <label className="form-label">{campo.label}</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={valorAtual}
                                        onChange={(e) => onChange(campo.key, e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}