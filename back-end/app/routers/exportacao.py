import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from openpyxl.styles import PatternFill, Font, Alignment
import pandas as pd

from app.config import BANCO_AUTENTICACAO, TABELAS_PERMITIDAS, PERFIL_ADMIN
from app.database import obter_conexao
from app.schemas.usuarios_schema import UsuarioToken
from app.security import exigir_perfil, registrar_log

router = APIRouter(prefix="/api", tags=["Exportação"])

# Mapeamento descritivo dos tipos de Unidade para exportação
TIPOS_UNIDADE_MAP = {
    1: "Registro",
    2: "Atuação",
    3: "Ambos"
}

@router.get("/exportar-excel/{tabela_alias}")
def exportar_excel(
    request: Request,
    tabela_alias: str,
    coluna_filtro: Optional[str] = Query(
        None, description="Coluna para filtrar (ex: importacaoLoteId)"
    ),
    valor_filtro: Optional[str] = Query(None, description="Valor do filtro"),
    colunas: Optional[str] = Query(
        None, description="Colunas desejadas separadas por vírgula"
    ),
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    try:
        tabela_alias_lower = tabela_alias.lower()
        if tabela_alias_lower not in TABELAS_PERMITIDAS:
            raise HTTPException(
                status_code=400,
                detail="Tabela não autorizada para exportação.",
            )

        config_tabela = TABELAS_PERMITIDAS[tabela_alias_lower]
        query_base = config_tabela["query_customizada"]

        # 1. Definição Dinâmica do Nome da Aba
        nome_aba = config_tabela.get("nome_aba")
        if not nome_aba:
            if "banco" in tabela_alias_lower:
                nome_aba = "MAPA_BANCOS"
            elif "unidade" in tabela_alias_lower:
                nome_aba = "MAPA_UNIDADES"
            elif "regra" in tabela_alias_lower or "depara" in tabela_alias_lower:
                nome_aba = "Regras_Plano"
            elif "folha" in tabela_alias_lower:
                nome_aba = "FOLHA_PAGAMENTO"
            else:
                nome_aba = "BASE_FINANCEIRA"

        # 2. Aplicação do Filtro via Subquery
        if coluna_filtro and valor_filtro:
            coluna_sanitizada = "".join(
                c for c in coluna_filtro if c.isalnum() or c in ["_", "."]
            )
            query = f"SELECT * FROM ({query_base}) AS SubTabela WHERE SubTabela.{coluna_sanitizada} = ?"
            params = [valor_filtro]
        else:
            query = query_base
            params = []

        conexao = obter_conexao(BANCO_AUTENTICACAO)
        df = pd.read_sql(query, conexao, params=params)
        conexao.close()

        if df.empty:
            raise HTTPException(
                status_code=404,
                detail="Nenhum registro encontrado para exportar.",
            )

        # 3. Tratamento de Enums / Tipos Específicos
        if "unidade" in tabela_alias_lower and "tipo" in df.columns:
            df["tipo"] = df["tipo"].map(lambda x: TIPOS_UNIDADE_MAP.get(x, x))

        # 4. Filtro de Colunas Solicitadas
        if colunas:
            colunas_solicitadas = [
                c.strip() for c in colunas.split(",") if c.strip()
            ]
            colunas_validas = [c for c in colunas_solicitadas if c in df.columns]
            if colunas_validas:
                df = df[colunas_validas]

        # 4.1 Transformar os nomes das colunas para MAIÚSCULO
        df.columns = [str(col).upper() for col in df.columns]

        # 5. Gerar Excel em memória com formatação
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=nome_aba)
            
            worksheet = writer.sheets[nome_aba]

            fill_header = PatternFill(start_color="35448A", end_color="35448A", fill_type="solid")
            font_header = Font(name="Arial", size=11, bold=True, color="FFFFFF")
            alignment_center = Alignment(horizontal="center", vertical="center")

            # Aplica estilo no cabeçalho (Linha 1)
            for cell in worksheet[1]:
                cell.fill = fill_header
                cell.font = font_header
                cell.alignment = alignment_center

            # Ajusta a largura das colunas dinamicamente
            for col in worksheet.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 10, 12)

        output.seek(0)

        # 6. Log de Auditoria
        registrar_log(
            usuario_id=admin.id,
            acao="EXPORTAR_EXCEL",
            tabela=tabela_alias_lower,
            detalhes={
                "total_linhas": len(df),
                "coluna_filtro": coluna_filtro,
                "valor_filtro": valor_filtro,
            },
            request=request,
        )

        # 7. Retorno do Download
        nome_download = f"Exportacao_{tabela_alias_lower}.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename="{nome_download}"'
        }

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        print(f"\n[ERRO] Falha ao exportar Excel ({tabela_alias}): {str(e)}\n")
        raise HTTPException(
            status_code=500, detail=f"Erro interno ao gerar Excel: {str(e)}"
        )