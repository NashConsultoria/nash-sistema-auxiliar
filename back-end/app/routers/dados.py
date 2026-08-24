from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.schemas.usuarios_schema import UsuarioToken
from app.database import executar_query
from app.security import obter_usuario_atual

router = APIRouter(tags=["Dados & Bases"])

@router.get("/databases")
def listar_bancos(usuario: UsuarioToken = Depends(obter_usuario_atual)):
    query = "SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')"
    databases = executar_query(query, banco="master")
    return [db["name"] for db in databases]


@router.get("/{banco}/tabelas")
def listar_tabelas(banco: str, usuario: UsuarioToken = Depends(obter_usuario_atual)):
    query = """
        SELECT TABLE_NAME as nome
        FROM INFORMATION_SCHEMA.TABLES  
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
    """
    tabelas = executar_query(query, banco=banco)
    for t in tabelas:
        t["registros"] = 6 if "NashBanco" in t["nome"] else 3
        t["nome_completo"] = f"dbo.{t['nome']}"
    return tabelas


@router.get("/{banco}/dados/{nome_tabela}")
def obter_dados_tabela(
    banco: str,
    nome_tabela: str,
    usuario: UsuarioToken = Depends(obter_usuario_atual),
):
    tabela_limpa = nome_tabela.replace("dbo.", "").strip()
    query = f"SELECT * FROM [{tabela_limpa}]"
    return executar_query(query, banco=banco)


@router.get("/{banco}/consolidado")
def obter_base_consolidada(
    banco: str,
    ano: Optional[int] = Query(None),
    contratante: Optional[str] = Query(None),
    usuario: UsuarioToken = Depends(obter_usuario_atual),
):
    query = """
        SELECT 
            m.id AS id, 
            c.nome AS contratante, 
            u.nome AS unidade, 
            b.nome AS banco, 
            bc.agencia AS agencia, 
            bc.conta AS conta,
            ISNULL(CONVERT(VARCHAR(10), m.data, 120), '') AS data, 
            m.descricao AS descricao, 
            m.obs AS obs,
            m.valor AS valor, 
            m.tipo AS tipo, 
            f.nome AS fornecedor, 
            f.cpf_cnpj AS cpf,
            pc.planoConta AS planoConta, 
            pc.grupoConta AS grupoConta, 
            pc.edre AS edre,
            pc.dfc AS dfc
        FROM dbo.BaseFinanceiro m
        LEFT JOIN dbo.ImportacaoLote l ON m.importacaoLoteId = l.id
        LEFT JOIN dbo.Contratante c ON l.contratanteId = c.id
        LEFT JOIN dbo.Unidade u ON m.unidadeId = u.id
        LEFT JOIN dbo.BancoConta bc ON m.bancoContaId = bc.id
        LEFT JOIN dbo.Banco b ON bc.bancoId = b.id
        LEFT JOIN dbo.PlanoContas pc ON m.planoContaId = pc.id
        LEFT JOIN dbo.Fornecedor f ON m.fornecedorId = f.id
        WHERE 1=1
    """

    params = []

    if ano is not None:
        query += " AND YEAR(m.data) = ?"
        params.append(int(ano))

    # Filtro de contratantes (aceita nomes separados por vírgula)
    if contratante:
        lista_contratantes = [
            c.strip() for c in contratante.split(",") if c.strip()
        ]
        if lista_contratantes:
            placeholders = ", ".join(["?"] * len(lista_contratantes))
            query += f" AND c.nome IN ({placeholders})"
            params.extend(lista_contratantes)

    return executar_query(query, banco=banco, params=params)

@router.get("/{banco}/folha-pagamento-tabular")
def obter_folha_pagamento_tabular(
    banco: str,
    ano: Optional[str] = Query(None),
    contratante: Optional[str] = Query(None),
    usuario: UsuarioToken = Depends(obter_usuario_atual),
):
    query = """
        SELECT 
            m.id AS id,
            ISNULL(c.nome, ISNULL(c_reg.nome, '')) AS contratante,
            ur.nome AS unidadeRegistro,
            ua.nome AS unidadeAtuacao,
            ISNULL(ua.cnpj, ISNULL(ur.cnpj, '')) AS cnpj,
            m.nome AS nome,
            m.cpf AS cpf,
            ISNULL(CONVERT(VARCHAR(10), m.dataNascimento, 120), '') AS dataNascimento,
            m.cboCargo AS cboCargo,
            m.cargo AS cargo,
            m.departamento AS departamento,
            ISNULL(CONVERT(VARCHAR(10), m.dataAdmissao, 120), '') AS dataAdmissao,
            m.descricao AS descricao,
            pc.planoConta AS planoConta,
            pc.grupoConta AS grupoConta,
            pc.efolha AS efolha,
            ISNULL(CONVERT(VARCHAR(10), m.dataCompetencia, 120), '') AS dataCompetencia,
            ISNULL(CONVERT(VARCHAR(10), m.dataCaixa, 120), '') AS dataCaixa,
            m.tipo AS tipo,
            m.valor AS valor
        FROM dbo.BaseFolhaPagamento m
        LEFT JOIN dbo.PlanoContas pc ON m.planoContaId = pc.id
        LEFT JOIN dbo.Unidade ua ON m.unidadeAtuacaoId = ua.id
        LEFT JOIN dbo.Unidade ur ON m.unidadeRegistroId = ur.id
        LEFT JOIN dbo.Contratante c ON ua.contratanteId = c.id
        LEFT JOIN dbo.Contratante c_reg ON ur.contratanteId = c_reg.id
        WHERE 1=1
    """

    params = []

    # Valida e converte o ano com segurança
    if ano and str(ano).isdigit():
        query += " AND YEAR(m.dataCompetencia) = ?"
        params.append(int(ano))

    if contratante:
        lista_contratantes = [
            c.strip().upper() for c in contratante.split(",") if c.strip()
        ]
        if lista_contratantes:
            placeholders = ", ".join(["?"] * len(lista_contratantes))
            query += f" AND (UPPER(TRIM(c.nome)) IN ({placeholders}) OR UPPER(TRIM(c_reg.nome)) IN ({placeholders}))"
            params.extend(lista_contratantes)
            params.extend(lista_contratantes)

    return executar_query(query, banco=banco, params=params)