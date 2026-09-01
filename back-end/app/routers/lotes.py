from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import PERFIL_ADMIN, PERFIL_CLIENTE
from app.database import obter_conexao
from app.schemas.usuarios_schema import UsuarioToken
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
                    WHEN LOWER(l.nomeArquivo) LIKE '%regras_fornecedor%' OR LOWER(l.nomeArquivo) LIKE '%regra_fornecedor%' THEN 'REGRAS FORNECEDOR (SISTEMA)'
                    WHEN LOWER(l.nomeArquivo) LIKE '%regra%' THEN 'REGRAS (SISTEMA)'
                    WHEN LOWER(l.nomeArquivo) LIKE '%mapa_bancos%' OR LOWER(l.nomeArquivo) LIKE '%mapa_banco%' THEN 'SISTEMA (MAPA BANCOS)'
                    WHEN LOWER(l.nomeArquivo) LIKE '%mapa_unidades%' OR LOWER(l.nomeArquivo) LIKE '%mapa_unidade%' THEN 'SISTEMA (MAPA UNIDADES)'
                    WHEN LOWER(l.nomeArquivo) LIKE '%mapa_fornecedor%' OR LOWER(l.nomeArquivo) LIKE '%mapa_fornecedores%' THEN 'SISTEMA (MAPA FORNECEDORES)'
                    ELSE 'PLANO DE CONTAS (SISTEMA)'
                END AS contratante,
                l.criadoEm,
                CASE 
                    /* REGRAS DE FORNECEDOR: Checa na tabela dbo.FornecedorRegras */
                    WHEN LOWER(l.nomeArquivo) LIKE '%regras_fornecedor%' OR LOWER(l.nomeArquivo) LIKE '%regra_fornecedor%' THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.FornecedorRegras WHERE importacaoLoteId = l.id), 0)
                    )
                    /* REGRAS DO PLANO: Checa na tabela dbo.PlanoDePara */
                    WHEN LOWER(l.nomeArquivo) LIKE '%regra%' THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.PlanoDePara WHERE importacaoLoteId = l.id), 0)
                    )
                    WHEN LOWER(l.nomeArquivo) LIKE '%mapa_bancos%' OR LOWER(l.nomeArquivo) LIKE '%mapa_banco%' THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.Banco WHERE importacaoLoteId = l.id), 0)
                    )
                    WHEN LOWER(l.nomeArquivo) LIKE '%mapa_unidades%' OR LOWER(l.nomeArquivo) LIKE '%mapa_unidade%' THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.Unidade WHERE importacaoLoteId = l.id), 0)
                    )
                    WHEN LOWER(l.nomeArquivo) LIKE '%mapa_fornecedor%' OR LOWER(l.nomeArquivo) LIKE '%mapa_fornecedores%' THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.Fornecedor WHERE importacaoLoteId = l.id), 0)
                    )
                    WHEN l.contratanteId IS NULL THEN (
                        ISNULL((SELECT COUNT(*) FROM dbo.PlanoContas WHERE importacaoLoteId = l.id), 0)
                    )
                    ELSE (
                        ISNULL((SELECT COUNT(*) FROM dbo.BaseFinanceiro WHERE importacaoLoteId = l.id), 0) +
                        ISNULL((SELECT COUNT(*) FROM dbo.BaseFolhaPagamento WHERE importacaoLoteId = l.id), 0)
                    )
                END AS totalMovimentacoes,
                (
                    ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.BaseFinanceiro WHERE importacaoLoteId = l.id), 0) +
                    ISNULL((SELECT SUM(ISNULL(valor, 0)) FROM dbo.BaseFolhaPagamento WHERE importacaoLoteId = l.id), 0)
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
        lotes = [
            {
                "id": row[0],
                "nomeArquivo": row[1],
                "contratante": row[2],
                "criadoEm": row[3].isoformat() if row[3] else None,
                "totalMovimentacoes": row[4],
                "valorTotal": float(row[5]) if row[5] is not None else 0.0,
            }
            for row in cursor.fetchall()
        ]

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

        # 2. DELEÇÃO EM CASCATA (Ordem estrita para não violar FKs)

        # A) Exclui Movimentações Financeiras e Folha que dependem de Unidade / BancoConta
        cursor.execute("DELETE FROM dbo.BaseFinanceiro WHERE importacaoLoteId = ?", (lote_id,))
        linhas_movimentacao = cursor.rowcount

        cursor.execute("DELETE FROM dbo.BaseFolhaPagamento WHERE importacaoLoteId = ?", (lote_id,))
        linhas_folha = cursor.rowcount

        # B) Exclui Regras / DePara e Plano de Contas
        cursor.execute("DELETE FROM dbo.PlanoDePara WHERE importacaoLoteId = ?", (lote_id,))
        linhas_regras = cursor.rowcount

        cursor.execute("DELETE FROM dbo.PlanoContas WHERE importacaoLoteId = ?", (lote_id,))
        linhas_plano_contas = cursor.rowcount

        cursor.execute("DELETE FROM dbo.FornecedorRegras WHERE importacaoLoteId = ?", (lote_id,))
        linhas_regras_fornecedor = cursor.rowcount

        # C) Exclui Fornecedores do lote
        cursor.execute("DELETE FROM dbo.Fornecedor WHERE importacaoLoteId = ?", (lote_id,))
        linhas_fornecedores = cursor.rowcount

        # D) PRIMEIRO: APAGA BANCOCONTA (Evita a FK da Unidade)
        # Deleta as contas ligadas diretamente a unidades do lote OU importadas no lote
        # D) PASSO CRÍTICO: Exclui BancoConta das unidades do lote ANTES de apagar a Unidade
        cursor.execute(
            """
            DELETE FROM dbo.BancoConta 
            WHERE unidadeId IN (SELECT id FROM dbo.Unidade WHERE importacaoLoteId = ?)
            """, 
            (lote_id,)
        )
        bancos_contas_removidos = cursor.rowcount

        # E) SEGUNDO: APAGA UNIDADE (Agora seguro, pois nenhuma BancoConta aponta para elas)
        cursor.execute("DELETE FROM dbo.Unidade WHERE importacaoLoteId = ?", (lote_id,))
        linhas_unidades = cursor.rowcount

        # F) Exclui Bancos do lote
        cursor.execute("DELETE FROM dbo.Banco WHERE importacaoLoteId = ?", (lote_id,))
        linhas_bancos = cursor.rowcount

        # 3. LIMPEZA DE ÓRFÃOS SEGUROS
        # A) Limpa BancoConta sem Unidade e sem histórico financeiro
        cursor.execute(
            """
            DELETE FROM dbo.BancoConta 
            WHERE unidadeId IS NULL AND id NOT IN (
                SELECT DISTINCT bancoContaId FROM dbo.BaseFinanceiro WHERE bancoContaId IS NOT NULL
                UNION
                SELECT DISTINCT bancoId FROM dbo.PlanoDePara WHERE bancoId IS NOT NULL
            )
            """
        )
        bancos_contas_orfas = cursor.rowcount

        # B) Limpa Fornecedores órfãos
        cursor.execute(
            """
            DELETE FROM dbo.Fornecedor 
            WHERE importacaoLoteId IS NULL AND id NOT IN (
                SELECT DISTINCT fornecedorId FROM dbo.BaseFinanceiro WHERE fornecedorId IS NOT NULL
                UNION
                SELECT DISTINCT fornecedorId FROM dbo.PlanoDePara WHERE fornecedorId IS NOT NULL
            )
            """
        )
        fornecedores_removidos = cursor.rowcount

        # C) Limpa Unidades órfãs (garantindo desvínculo em BancoConta antes, se houver)
        cursor.execute(
            """
            DELETE FROM dbo.BancoConta
            WHERE unidadeId IN (
                SELECT id FROM dbo.Unidade 
                WHERE importacaoLoteId IS NULL AND id NOT IN (
                    SELECT DISTINCT unidadeId FROM dbo.BaseFinanceiro WHERE unidadeId IS NOT NULL
                    UNION
                    SELECT DISTINCT unidadeRegistroId FROM dbo.BaseFolhaPagamento WHERE unidadeRegistroId IS NOT NULL
                    UNION
                    SELECT DISTINCT unidadeAtuacaoId FROM dbo.BaseFolhaPagamento WHERE unidadeAtuacaoId IS NOT NULL
                    UNION
                    SELECT DISTINCT unidadeId FROM dbo.PlanoDePara WHERE unidadeId IS NOT NULL
                )
            )
            """
        )

        cursor.execute(
            """
            DELETE FROM dbo.Unidade 
            WHERE importacaoLoteId IS NULL AND id NOT IN (
                SELECT DISTINCT unidadeId FROM dbo.BaseFinanceiro WHERE unidadeId IS NOT NULL
                UNION
                SELECT DISTINCT unidadeRegistroId FROM dbo.BaseFolhaPagamento WHERE unidadeRegistroId IS NOT NULL
                UNION
                SELECT DISTINCT unidadeAtuacaoId FROM dbo.BaseFolhaPagamento WHERE unidadeAtuacaoId IS NOT NULL
                UNION
                SELECT DISTINCT unidadeId FROM dbo.PlanoDePara WHERE unidadeId IS NOT NULL
            )
            """
        )
        unidades_orfas_removidas = cursor.rowcount

        # 4. Deleta o registro do Lote principal
        cursor.execute("DELETE FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,))

        # 5. Log de auditoria
        detalhes_log = {
            "loteId": lote_id,
            "arquivo": nome_arquivo,
            "linhasApagadas": {
                "bancos": linhas_bancos,
                "unidades": linhas_unidades,
                "fornecedores": linhas_fornecedores,
                "regrasPlano": linhas_regras,
                "planoContas": linhas_plano_contas,
                "movimentacoes": linhas_movimentacao,
                "folhaPagamento": linhas_folha,
            },
            "orfaosLimpos": {
                "fornecedores": fornecedores_removidos,
                "bancosContas": bancos_contas_removidos + bancos_contas_orfas,
                "unidadesOrfas": unidades_orfas_removidas,
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
            "detalhes": detalhes_log["linhasApagadas"],
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