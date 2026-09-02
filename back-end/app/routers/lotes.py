from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.config import PERFIL_ADMIN, PERFIL_CLIENTE, TIPOS_LOTE_SISTEMA, CASCATA_SIMPLES
from app.database import obter_conexao
from app.schemas.usuarios_schema import UsuarioToken
from app.security import exigir_perfil, obter_usuario_atual, registrar_log

router = APIRouter(prefix="/api", tags=["Lotes de Importação"])


# ---------------------------------------------------------------------------
# Helpers de SQL gerados a partir de TIPOS_LOTE_SISTEMA (app/lotes_config.py).
# Adicionar um novo tipo de lote lá é o suficiente para ele aparecer aqui.
# ---------------------------------------------------------------------------

def _condicao_padroes(alias_arquivo: str, padroes: list[str]) -> str:
    return " OR ".join(f"LOWER({alias_arquivo}) LIKE '%{p}%'" for p in padroes)


def _case_classificacao_contratante(
    alias_arquivo: str = "l.nomeArquivo",
    alias_contratante_id: str = "l.contratanteId",
    alias_nome_contratante: str = "c.nome",
) -> str:
    """Monta o CASE WHEN que decide o texto exibido na coluna 'contratante'."""
    partes = [f"CASE WHEN {alias_contratante_id} IS NOT NULL THEN {alias_nome_contratante}"]
    for tipo in TIPOS_LOTE_SISTEMA:
        condicao = _condicao_padroes(alias_arquivo, tipo.padroes)
        partes.append(f"WHEN {condicao} THEN '{tipo.label}'")
    partes.append("ELSE 'PLANO DE CONTAS (SISTEMA)' END")
    return " ".join(partes)


def _case_total_movimentacoes(
    alias_arquivo: str = "l.nomeArquivo",
    alias_contratante_id: str = "l.contratanteId",
    alias_id: str = "l.id",
) -> str:
    """Monta o CASE WHEN que decide como contar 'totalMovimentacoes'."""
    partes = ["CASE"]
    for tipo in TIPOS_LOTE_SISTEMA:
        condicao = _condicao_padroes(alias_arquivo, tipo.padroes)
        partes.append(
            f"WHEN {condicao} THEN "
            f"(ISNULL((SELECT COUNT(*) FROM {tipo.tabela_contagem} "
            f"WHERE importacaoLoteId = {alias_id}), 0))"
        )
    partes.append(
        f"WHEN {alias_contratante_id} IS NULL THEN "
        f"(ISNULL((SELECT COUNT(*) FROM dbo.PlanoContas WHERE importacaoLoteId = {alias_id}), 0))"
    )
    partes.append(
        "ELSE ("
        f"ISNULL((SELECT COUNT(*) FROM dbo.BaseFinanceiro WHERE importacaoLoteId = {alias_id}), 0) + "
        f"ISNULL((SELECT COUNT(*) FROM dbo.BaseFolhaPagamento WHERE importacaoLoteId = {alias_id}), 0)"
        ")"
    )
    partes.append("END")
    return " ".join(partes)


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

        query = f"""
            SELECT
                l.id,
                l.nomeArquivo,
                {_case_classificacao_contratante()} AS contratante,
                l.criadoEm,
                {_case_total_movimentacoes()} AS totalMovimentacoes,
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


# ---------------------------------------------------------------------------
# Exclusão em cascata
# ---------------------------------------------------------------------------

def _excluir_e_contar(cursor, tabela: str, lote_id: int, coluna: str = "importacaoLoteId") -> int:
    cursor.execute(f"DELETE FROM {tabela} WHERE {coluna} = ?", (lote_id,))
    return cursor.rowcount


def _limpar_bancoconta_e_unidade_do_lote(cursor, lote_id: int) -> tuple[int, int]:
    """BancoConta depende de Unidade, então precisa ser apagado primeiro."""
    cursor.execute(
        """
        DELETE FROM dbo.BancoConta
        WHERE unidadeId IN (SELECT id FROM dbo.Unidade WHERE importacaoLoteId = ?)
        """,
        (lote_id,),
    )
    bancos_contas_removidos = cursor.rowcount

    linhas_unidades = _excluir_e_contar(cursor, "dbo.Unidade", lote_id)
    return bancos_contas_removidos, linhas_unidades


# Limpeza de órfãos que não têm relação direta com um lote específico —
# rodam sempre depois da exclusão do lote, para varrer o que ficou solto.
def _limpar_orfaos(cursor) -> dict:
    resultados = {}

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
    resultados["bancosContasOrfas"] = cursor.rowcount

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
    resultados["fornecedoresRemovidos"] = cursor.rowcount

    # Unidades órfãs: primeiro desvincula BancoConta, depois apaga a Unidade
    condicao_unidade_em_uso = """
        SELECT DISTINCT unidadeId FROM dbo.BaseFinanceiro WHERE unidadeId IS NOT NULL
        UNION
        SELECT DISTINCT unidadeRegistroId FROM dbo.BaseFolhaPagamento WHERE unidadeRegistroId IS NOT NULL
        UNION
        SELECT DISTINCT unidadeAtuacaoId FROM dbo.BaseFolhaPagamento WHERE unidadeAtuacaoId IS NOT NULL
        UNION
        SELECT DISTINCT unidadeId FROM dbo.PlanoDePara WHERE unidadeId IS NOT NULL
    """
    cursor.execute(
        f"""
        DELETE FROM dbo.BancoConta
        WHERE unidadeId IN (
            SELECT id FROM dbo.Unidade
            WHERE importacaoLoteId IS NULL AND id NOT IN ({condicao_unidade_em_uso})
        )
        """
    )
    cursor.execute(
        f"""
        DELETE FROM dbo.Unidade
        WHERE importacaoLoteId IS NULL AND id NOT IN ({condicao_unidade_em_uso})
        """
    )
    resultados["unidadesOrfasRemovidas"] = cursor.rowcount

    return resultados


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

        cursor.execute(
            "SELECT nomeArquivo FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,)
        )
        lote = cursor.fetchone()
        if not lote:
            raise HTTPException(
                status_code=404, detail="Lote de importação não encontrado."
            )
        nome_arquivo = lote[0]

        # 1) Tabelas simples, sem dependências entre si
        linhas_apagadas = {
            nome_resultado: _excluir_e_contar(cursor, tabela, lote_id)
            for nome_resultado, tabela in CASCATA_SIMPLES
        }

        # 2) BancoConta -> Unidade (ordem importa: BancoConta depende de Unidade)
        bancos_contas_removidos, linhas_apagadas["unidades"] = _limpar_bancoconta_e_unidade_do_lote(
            cursor, lote_id
        )

        # 3) Banco do lote
        linhas_apagadas["bancos"] = _excluir_e_contar(cursor, "dbo.Banco", lote_id)

        # 4) Limpeza de órfãos que sobraram soltos no banco
        orfaos_limpos = _limpar_orfaos(cursor)
        orfaos_limpos["bancosContas"] = bancos_contas_removidos + orfaos_limpos.pop("bancosContasOrfas")

        # 5) Apaga o registro do lote em si
        cursor.execute("DELETE FROM dbo.ImportacaoLote WHERE id = ?", (lote_id,))

        # 6) Log de auditoria
        detalhes_log = {
            "loteId": lote_id,
            "arquivo": nome_arquivo,
            "linhasApagadas": linhas_apagadas,
            "orfaosLimpos": orfaos_limpos,
        }

        registrar_log(
            usuario_id=usuario.id,
            acao="Excluir",
            tabela="ImportacaoLote",
            detalhes=detalhes_log,
            request=request,
        )

        conexao.commit()

        return {
            "sucesso": True,
            "mensagem": f"Lote '{nome_arquivo}' (ID: {lote_id}) excluído com sucesso!",
            "detalhes": linhas_apagadas,
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