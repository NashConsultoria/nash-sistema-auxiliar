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
    conexao = None
    try:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        query = """
            SELECT 
                l.id,
                l.nomeArquivo,
                CASE 
                    WHEN l.contratanteId IS NOT NULL THEN c.nome
                    WHEN LOWER(l.nomeArquivo) LIKE '%regra%' THEN 'REGRAS (SISTEMA)'
                    ELSE 'PLANO DE CONTAS (SISTEMA)'
                END AS contratante,
                l.criadoEm,
                CASE 
                    WHEN LOWER(l.nomeArquivo) LIKE '%regra%' THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.PlanoDePara WHERE importacaoLoteId = l.id), 0)
                    )
                    WHEN l.contratanteId IS NULL THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.PlanoContas), 0)
                    )
                    ELSE (
                        ISNULL((SELECT COUNT(*) FROM dbo.Movimentacao WHERE importacaoLoteId = l.id), 0) +
                        ISNULL((SELECT COUNT(*) FROM dbo.MovimentacaoFolhaPagamento WHERE importacaoLoteId = l.id), 0)
                    )
                END AS totalMovimentacoes,
                (
                    ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.Movimentacao WHERE importacaoLoteId = l.id), 0) +
                    ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.MovimentacaoFolhaPagamento WHERE importacaoLoteId = l.id), 0)
                ) AS valorTotal
            FROM dbo.ImportacaoLote l
            LEFT JOIN dbo.Contratante c ON l.contratanteId = c.id
            WHERE 1=1
        """
        params = []

        if usuario.perfil == PERFIL_CLIENTE:
            query += " AND l.contratanteId = ?"
            params.append(usuario.contratanteId)
        elif contratante_id:
            query += " AND l.contratanteId = ?"
            params.append(contratante_id)

        query += " ORDER BY l.criadoEm DESC"

        cursor.execute(query, params)
        lotes = []
        for row in cursor.fetchall():
            lotes.append(
                {
                    "id": row[0],
                    "nomeArquivo": row[1],
                    "contratante": row[2],
                    # Retorna no padrão ISO para o frontend manipular sem erro de 'Invalid Date'
                    "criadoEm": row[3].isoformat() if row[3] else None,
                    "totalMovimentacoes": row[4],
                    "valorTotal": float(row[5]) if row[5] is not None else 0.0,
                }
            )

        return {"sucesso": True, "lotes": lotes}

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao buscar lotes: {str(e)}"
        )
    finally:
        if conexao:
            conexao.close()


@router.delete("/{banco}/lotes/{lote_id}")
def deletar_lote_importacao(
    banco: str,
    lote_id: int,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = None
    try:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        # 1. Verifica se o lote existe
        cursor.execute(
            "SELECT nomeArquivo FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,)
        )
        lote = cursor.fetchone()

        if not lote:
            raise HTTPException(
                status_code=404, detail="Lote de importação não encontrado."
            )

        nome_arquivo = lote[0]

        # 2. Deleta as regras do Plano de Contas atreladas a este lote
        cursor.execute(
            "DELETE FROM dbo.PlanoDePara WHERE importacaoLoteId = ?", (lote_id,)
        )
        linhas_regras = cursor.rowcount

        # 3. Deleta as movimentações financeiras e de folha
        cursor.execute(
            "DELETE FROM dbo.Movimentacao WHERE importacaoLoteId = ?", (lote_id,)
        )
        linhas_movimentacao = cursor.rowcount

        cursor.execute(
            "DELETE FROM dbo.MovimentacaoFolhaPagamento WHERE importacaoLoteId = ?",
            (lote_id,),
        )
        linhas_folha = cursor.rowcount

        # 4. LIMPEZA DE CADASTROS ÓRFÃOS (Considera também regras em PlanoDePara)

        # A) Limpa Fornecedores sem referência
        cursor.execute(
            """
            DELETE FROM dbo.Fornecedor 
            WHERE id NOT IN (
                SELECT DISTINCT fornecedorId FROM dbo.Movimentacao WHERE fornecedorId IS NOT NULL
            )
        """
        )
        fornecedores_removidos = cursor.rowcount

        # B) Limpa BancoConta sem referência
        cursor.execute(
            """
            DELETE FROM dbo.BancoConta 
            WHERE id NOT IN (
                SELECT DISTINCT bancoContaId FROM dbo.Movimentacao WHERE bancoContaId IS NOT NULL
                UNION
                SELECT DISTINCT bancoId FROM dbo.PlanoDePara WHERE bancoId IS NOT NULL
            )
        """
        )
        bancos_removidos = cursor.rowcount

        # C) Limpa Unidades sem referência
        cursor.execute(
            """
            DELETE FROM dbo.Unidade 
            WHERE id NOT IN (
                SELECT DISTINCT unidadeId FROM dbo.Movimentacao WHERE unidadeId IS NOT NULL
                UNION
                SELECT DISTINCT unidadeRegistroId FROM dbo.MovimentacaoFolhaPagamento WHERE unidadeRegistroId IS NOT NULL
                UNION
                SELECT DISTINCT unidadeAtuacaoId FROM dbo.MovimentacaoFolhaPagamento WHERE unidadeAtuacaoId IS NOT NULL
                UNION
                SELECT DISTINCT unidadeId FROM dbo.PlanoDePara WHERE unidadeId IS NOT NULL
            )
        """
        )
        unidades_removidas = cursor.rowcount

        # 5. Deleta o lote em si
        cursor.execute("DELETE FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,))

        # 6. Registra log de auditoria
        detalhes_log = {
            "loteId": lote_id,
            "arquivo": nome_arquivo,
            "linhasApagadas": {
                "regrasPlano": linhas_regras,
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

        return {
            "sucesso": True,
            "mensagem": f"Lote '{nome_arquivo}' (ID: {lote_id}) excluído com sucesso!",
            "detalhes": {
                "regrasExcluidas": linhas_regras,
                "movimentacoesExcluidas": linhas_movimentacao,
                "folhaExcluida": linhas_folha,
                "fornecedoresOrfaosRemovidos": fornecedores_removidos,
                "bancosOrfaosRemovidos": bancos_removidos,
                "unidadesOrfasRemovidas": unidades_removidas,
            },
        }

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar lote: {str(e)}")
    finally:
        if conexao:
            conexao.close()