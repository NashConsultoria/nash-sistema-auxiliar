from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.usuarios import UsuarioToken
from app.database import executar_query
from app.security import exigir_perfil, registrar_log
from app.schemas.regraplano import RegraPlanoSchema

router = APIRouter(prefix="/api", tags=["Plano de Contas"])

@router.get("/{banco}/planocontas")
async def obter_plano_contas(banco: str):
    try:
        # 1. Certifique-se de que a query SQL aponta para a tabela correta
        sql = "SELECT id, planoConta, grupoConta, edre, dfc, efolha FROM planocontas"
        
        # 2. Executa no banco dinâmico enviado pela URL
        dados = executar_query(sql, banco=banco) 
        
        return dados
    except Exception as e:
        # Isso fará o erro exato do Python / MySQL aparecer no console do React/Network
        print(f"Erro ao buscar plano de contas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no BD: {str(e)}")


@router.get("/{banco}/regras-planocontas")
async def obter_regras_planocontas(banco: str):
    try:
        sql = """
            SELECT 
                pdp.id,
                pdp.termoDescricao,
                pdp.termoTipo,
                pdp.termoFornecedor,
                pdp.planoContaId,
                pdp.contratanteId,
                c.nome AS contratanteNome,
                pdp.unidadeId,
                u.nome AS unidadeNome,
                pdp.bancoId,
                b.banco AS bancoNome,
                pc.planoConta AS destino,
                pc.grupoConta
            FROM PlanoDePara pdp
            INNER JOIN PlanoContas pc ON pdp.planoContaId = pc.id
            LEFT JOIN Contratante c ON pdp.contratanteId = c.id
            LEFT JOIN Unidade u ON pdp.unidadeId = u.id
            LEFT JOIN BancoConta b ON pdp.bancoId = b.id
            ORDER BY pdp.id DESC
        """
        dados = executar_query(sql, banco=banco)
        return dados
    except Exception as e:
        print(f"Erro no BD ao buscar regras: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no BD: {str(e)}")

@router.post("/{banco}/regras-planocontas")
async def criar_regra_planocontas(banco: str, regra: RegraPlanoSchema):
    try:
        # VALIDAÇÃO: Pelo menos um dos termos deve estar preenchido
        if not (regra.termoDescricao or regra.termoTipo or regra.termoFornecedor):
            raise HTTPException(
                status_code=400,
                detail="Preencha ao menos um dos campos: Descrição, Tipo ou Fornecedor."
            )

        # 1. Verifica se já existe uma regra idêntica
        sql_check = """
            SELECT id FROM PlanoDePara 
            WHERE ISNULL(termoDescricao, '') = ISNULL(?, '')
              AND ISNULL(termoTipo, '') = ISNULL(?, '')
              AND ISNULL(termoFornecedor, '') = ISNULL(?, '')
              AND ISNULL(contratanteId, 0) = ISNULL(?, 0)
              AND ISNULL(unidadeId, 0) = ISNULL(?, 0)
              AND ISNULL(bancoId, 0) = ISNULL(?, 0)
        """
        params_check = (
            regra.termoDescricao,
            regra.termoTipo,
            regra.termoFornecedor,
            regra.contratanteId,
            regra.unidadeId,
            regra.bancoId
        )
        existente = executar_query(sql_check, banco=banco, params=params_check)

        if existente:
            raise HTTPException(
                status_code=400, 
                detail="Já existe uma regra idêntica cadastrada para estes critérios."
            )

        # 2. Insere com as novas colunas (Vírgula corrigida após termoTipo)
        sql_insert = """
            INSERT INTO PlanoDePara (
                contratanteId, 
                unidadeId, 
                bancoId, 
                termoDescricao, 
                termoTipo,
                termoFornecedor, 
                planoContaId
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        params_insert = (
            regra.contratanteId,
            regra.unidadeId,
            regra.bancoId,
            regra.termoDescricao,
            regra.termoTipo,
            regra.termoFornecedor,
            regra.planoContaId
        )
        
        executar_query(sql_insert, banco=banco, params=params_insert)
        
        return {"sucesso": True, "mensagem": "Regra cadastrada com sucesso!"}

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        print(f"Erro ao inserir regra: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao salvar regra: {str(e)}")


@router.put("/{banco}/regras-planocontas/{regra_id}")
async def atualizar_regra_planocontas(
    banco: str, regra_id: int, regra: RegraPlanoSchema
):
    try:
        # VALIDAÇÃO: Pelo menos um dos termos deve estar preenchido
        if not (regra.termoDescricao or regra.termoTipo or regra.termoFornecedor):
            raise HTTPException(
                status_code=400,
                detail="Preencha ao menos um dos campos: Descrição, Tipo ou Fornecedor."
            )

        sql = """
            UPDATE PlanoDePara 
            SET contratanteId = ?, 
                unidadeId = ?, 
                bancoId = ?, 
                termoDescricao = ?, 
                termoTipo = ?,
                termoFornecedor = ?, 
                planoContaId = ?,
                importacaoLoteId = NULL
            WHERE id = ?
        """
        params = (
            regra.contratanteId,
            regra.unidadeId,
            regra.bancoId,
            regra.termoDescricao,
            regra.termoTipo,
            regra.termoFornecedor,
            regra.planoContaId,
            regra_id,
        )

        executar_query(sql, banco=banco, params=params)

        return {
            "sucesso": True,
            "mensagem": "Regra atualizada com sucesso e salva como customizada!",
        }
    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        print(f"Erro ao atualizar regra: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Erro ao atualizar regra: {str(e)}"
        )


@router.delete("/{banco}/regras-planocontas/{regra_id}")
async def excluir_regra_planocontas(banco: str, regra_id: int):
    try:
        sql_verifica = "SELECT id FROM PlanoDePara WHERE id = ?"
        existe = executar_query(sql_verifica, banco=banco, params=(regra_id,))
        
        if not existe:
            raise HTTPException(status_code=404, detail="Regra não encontrada.")

        sql_delete = "DELETE FROM PlanoDePara WHERE id = ?"
        executar_query(sql_delete, banco=banco, params=(regra_id,))
        
        return {"sucesso": True, "mensagem": "Regra excluída com sucesso!"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao excluir regra: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no BD: {str(e)}")