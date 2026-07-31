import pyodbc
import pandas as pd
from fastapi import HTTPException
from app.config import CONEXAO_BASE

def obter_conexao(banco: str):
    conn_str = CONEXAO_BASE + f"Database={banco};"
    return pyodbc.connect(conn_str)

def executar_query(
    query: str, banco: str = "master", params: tuple | list = None
):
    conexao = obter_conexao(banco)
    try:
        cursor = conexao.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)

        # Se for uma consulta de seleção (SELECT)
        if cursor.description:
            colunas = [col[0] for col in cursor.description]
            linhas = cursor.fetchall()

            # Converte valores do tipo datetime para string para evitar erro de JSON Serialization
            dados = []
            for linha in linhas:
                linha_dict = {}
                for col, val in zip(colunas, linha):
                    if hasattr(val, "isoformat"):
                        linha_dict[col] = val.isoformat()
                    else:
                        linha_dict[col] = val
                dados.append(linha_dict)

            return dados

        conexao.commit()
        return []
    finally:
        conexao.close()