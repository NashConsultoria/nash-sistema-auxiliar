from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import PERFIL_ADMIN, PERFIL_CLIENTE
from app.database import obter_conexao
from app.schemas.usuarios import UsuarioToken
from app.security import exigir_perfil, obter_usuario_atual, registrar_log

router = APIRouter(prefix="/api", tags=["Lotes de Importação"])


@router.get("/{banco}/lotes")
def listar_lotes_importacao(
    banco: str,
    contratante_id: Optional[int] = Query(None),
    usuario: UsuarioToken = Depends(obter_usuario_atual),
):
    try:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        query = """
            SELECT 
                l.id,
                l.nomeArquivo,
                COALESCE(c.nome, 'PLANO DE CONTAS (SISTEMA)') AS contratante,
                l.criadoEm,
                CASE 
                    WHEN l.contratanteId IS NULL THEN (SELECT COUNT(*) FROM dbo.PlanoContas)
                    ELSE COUNT(m.id)
                END AS totalMovimentacoes,
                SUM(ISNULL(m.valor, 0)) AS valorTotal
            FROM dbo.ImportacaoLote l
            LEFT JOIN dbo.Contratante c ON l.contratanteId = c.id
            LEFT JOIN dbo.Movimentacao m ON m.importacaoLoteId = l.id
            WHERE 1=1
        """
        params = []

        # Se for cliente, restringe visualização apenas ao seu contratante
        if usuario.perfil == PERFIL_CLIENTE:
            query += " AND l.contratanteId = ?"
            params.append(usuario.contratanteId)
        elif contratante_id:
            query += " AND l.contratanteId = ?"
            params.append(contratante_id)

        # l.contratanteId no GROUP BY para compatibilidade com SQL Server
        query += """ 
            GROUP BY l.id, l.nomeArquivo, c.nome, l.criadoEm, l.contratanteId 
            ORDER BY l.criadoEm DESC
        """

        cursor.execute(query, params)
        lotes = []
        for row in cursor.fetchall():
            lotes.append(
                {
                    "id": row[0],
                    "nomeArquivo": row[1],
                    "contratante": row[2],
                    "criadoEm": (
                        row[3].strftime("%d/%m/%Y %H:%M:%S") if row[3] else None
                    ),
                    "totalMovimentacoes": row[4],
                    "valorTotal": float(row[5]),
                }
            )

        conexao.close()
        return {"sucesso": True, "lotes": lotes}

    except Exception as e:
        if "conexao" in locals() and conexao:
            conexao.close()
        return {"sucesso": False, "mensagem": f"Erro ao buscar lotes: {str(e)}"}


@router.delete("/{banco}/lotes/{lote_id}")
def deletar_lote_importacao(
    banco: str,
    lote_id: int,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    try:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        # 1. Verifica se o lote existe
        cursor.execute(
            "SELECT nomeArquivo FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,)
        )
        lote = cursor.fetchone()

        if not lote:
            conexao.close()
            raise HTTPException(
                status_code=404, detail="Lote de importação não encontrado."
            )

        nome_arquivo = lote[0]

        # 2. Deleta as movimentações financeiras e de folha de pagamento ligadas ao lote
        cursor.execute(
            "DELETE FROM dbo.Movimentacao WHERE importacaoLoteId = ?", (lote_id,)
        )
        linhas_movimentacao = cursor.rowcount

        cursor.execute(
            "DELETE FROM dbo.MovimentacaoFolhaPagamento WHERE importacaoLoteId = ?",
            (lote_id,),
        )
        linhas_folha = cursor.rowcount

        # 3. LIMPEZA DE CADASTROS ÓRFÃOS (apenas os sem movimentação no banco)

        # A) Limpa Fornecedores sem movimentação
        cursor.execute(
            """
            DELETE FROM dbo.Fornecedor 
            WHERE id NOT IN (
                SELECT DISTINCT fornecedorId 
                FROM dbo.Movimentacao 
                WHERE fornecedorId IS NOT NULL
            )
        """
        )
        fornecedores_removidos = cursor.rowcount

        # B) Limpa BancoConta sem movimentação
        cursor.execute(
            """
            DELETE FROM dbo.BancoConta 
            WHERE id NOT IN (
                SELECT DISTINCT bancoContaId 
                FROM dbo.Movimentacao 
                WHERE bancoContaId IS NOT NULL
            )
        """
        )
        bancos_removidos = cursor.rowcount

        # C) Limpa Unidades sem movimentação (considera Movimentacao e MovimentacaoFolhaPagamento)
        cursor.execute(
            """
            DELETE FROM dbo.Unidade 
            WHERE id NOT IN (
                SELECT DISTINCT unidadeId 
                FROM dbo.Movimentacao 
                WHERE unidadeId IS NOT NULL
                
                UNION
                
                SELECT DISTINCT unidadeRegistroId 
                FROM dbo.MovimentacaoFolhaPagamento 
                WHERE unidadeRegistroId IS NOT NULL

                UNION

                SELECT DISTINCT unidadeAtuacaoId 
                FROM dbo.MovimentacaoFolhaPagamento 
                WHERE unidadeAtuacaoId IS NOT NULL
            )
        """
        )
        unidades_removidas = cursor.rowcount

        # 4. Deleta o registro do lote em si
        cursor.execute("DELETE FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,))

        # 5. Registra log detalhado da ação
        detalhes_log = {
            "loteId": lote_id,
            "arquivo": nome_arquivo,
            "linhasApagadas": {
                "movimentacoes": linhas_movimentacao,
                "folhaPagamento": linhas_folha,
            },
            "orfaosLimpos": {
                "fornecedores": fornecedores_removidos,
                "bancos": bancos_removidos,
                "unidades": unidades_removidas,
            },
        }

        registrar_log(
            usuario_id=usuario.id,
            acao="ExclusaoLote",
            tabela="ImportacaoLote",
            detalhes=detalhes_log,
            request=request,
        )

        conexao.commit()
        conexao.close()

        return {
            "sucesso": True,
            "mensagem": f"Lote '{nome_arquivo}' (ID: {lote_id}) excluído com sucesso!",
            "detalhes": {
                "movimentacoesExcluidas": linhas_movimentacao,
                "folhaExcluida": linhas_folha,
                "fornecedoresOrfaosRemovidos": fornecedores_removidos,
                "bancosOrfaosRemovidos": bancos_removidos,
                "unidadesOrfasRemovidas": unidades_removidas,
            },
        }

    except Exception as e:
        if "conexao" in locals() and conexao:
            conexao.rollback()
            conexao.close()
        return {"sucesso": False, "mensagem": f"Erro ao deletar lote: {str(e)}"}