from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from typing import List, Optional

from app.schemas.usuarios_schema import UsuarioToken
from app.schemas.regraplano_schema import RegraPlanoSchema
from app.schemas.planoContas_schema import PlanoContasBase, PlanoContasCreate, PlanoContasResponse, PlanoContasUpdate
from app.config import BANCO_AUTENTICACAO, PERFIL_ADMIN, PERFIL_FUNCIONARIO
from app.database import executar_query, obter_conexao
from app.security import exigir_perfil, registrar_log

router = APIRouter(prefix="/api", tags=["Plano de Contas"])

@router.get("/{banco}/planocontas", response_model=List[PlanoContasResponse])
async def obter_plano_contas(
    banco: str,
    apenas_ativos: bool = Query(True, description="Se True, traz apenas registros com status = 1"),
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    try:
        sql = """
            SELECT id, planoConta, grupoConta, edre, dfc, efolha, status, importacaoLoteId, criadoEm 
            FROM dbo.PlanoContas
        """
        params = []
        
        if apenas_ativos:
            sql += " WHERE status = 1"

        sql += " ORDER BY id DESC"

        dados = executar_query(sql, params=params, banco=banco) 
        return dados
    except Exception as e:
        print(f"Erro ao buscar plano de contas: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no BD: {str(e)}")

# 1. CRIAR NOVO PLANO DE CONTAS
@router.post("/{banco}/planocontas", response_model=PlanoContasResponse, status_code=status.HTTP_201_CREATED)
async def criar_plano_contas(
    banco: str,
    dados: PlanoContasCreate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(banco)
    cursor = conexao.cursor()
    try:
        # 1. Tratamento e limpeza dos campos
        plano_limpo = dados.planoConta.strip() if dados.planoConta else ""
        grupo_limpo = dados.grupoConta.strip() if dados.grupoConta else ""
        edre_limpo = dados.edre.strip() if dados.edre else ""
        dfc_limpo = dados.dfc.strip() if dados.dfc else ""
        efolha_limpo = dados.efolha.strip() if dados.efolha else ""

        # 2. Checa duplicidade considerando a combinação dos 5 níveis
        sql_duplicado = """
            SELECT id FROM dbo.PlanoContas 
            WHERE UPPER(TRIM(planoConta)) = UPPER(?)
              AND UPPER(TRIM(grupoConta)) = UPPER(?)
              AND UPPER(TRIM(edre))       = UPPER(?)
              AND UPPER(TRIM(dfc))        = UPPER(?)
              AND UPPER(TRIM(efolha))     = UPPER(?)
        """
        cursor.execute(sql_duplicado, (plano_limpo, grupo_limpo, edre_limpo, dfc_limpo, efolha_limpo))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400, 
                detail="Já existe um plano de contas cadastrado com essa exata combinação de Plano, Grupo, E-DRE, DFC e E-Folha."
            )

        # 3. Insere o novo registro
        sql_insert = """
            INSERT INTO dbo.PlanoContas (planoConta, grupoConta, edre, dfc, efolha, status, importacaoLoteId)
            OUTPUT INSERTED.id, INSERTED.criadoEm
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(
            sql_insert, 
            (plano_limpo, grupo_limpo, edre_limpo, dfc_limpo, efolha_limpo, dados.status, dados.importacaoLoteId)
        )
        row = cursor.fetchone()
        novo_id = int(row[0])
        criado_em = row[1]

        # 4. Auditoria via Registro de Log
        registrar_log(
            usuario_id=usuario.id,
            acao="Cadastro",
            tabela="PlanoContas",
            detalhes={
                "id": novo_id,
                "planoConta": plano_limpo,
                "grupoConta": grupo_limpo,
                "edre": edre_limpo,
                "dfc": dfc_limpo,
                "efolha": efolha_limpo,
                "status": dados.status,
                "importacaoLoteId": dados.importacaoLoteId
            },
            request=request
        )

        conexao.commit()

        return {
            "id": novo_id,
            "planoConta": plano_limpo,
            "grupoConta": grupo_limpo,
            "edre": edre_limpo,
            "dfc": dfc_limpo,
            "efolha": efolha_limpo,
            "status": dados.status,
            "importacaoLoteId": dados.importacaoLoteId,
            "criadoEm": criado_em
        }

    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cadastrar plano de contas: {str(e)}")
    finally:
        conexao.close()

# 2. ATUALIZAR PLANO DE CONTAS
@router.put("/{banco}/planocontas/{id}", response_model=PlanoContasResponse)
async def atualizar_plano_contas(
    banco: str,
    id: int,
    dados: PlanoContasUpdate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(banco)
    cursor = conexao.cursor()
    try:
        # 1. Busca o registro atual no banco
        cursor.execute(
            "SELECT id, planoConta, grupoConta, edre, dfc, efolha, status, importacaoLoteId, criadoEm FROM dbo.PlanoContas WHERE id = ?", 
            (id,)
        )
        atual = cursor.fetchone()
        if not atual:
            raise HTTPException(status_code=404, detail="Plano de contas não encontrado.")

        # Converte a tupla atual para variáveis
        _, p_orig, g_orig, e_orig, d_orig, ef_orig, st_orig, lote_orig, criado_em = atual

        # 2. Trata os novos valores (se enviados, faz o strip; se não enviados, mantém o original)
        p_novo = dados.planoConta.strip() if dados.planoConta is not None else p_orig
        g_novo = dados.grupoConta.strip() if dados.grupoConta is not None else g_orig
        e_novo = dados.edre.strip() if dados.edre is not None else e_orig
        d_novo = dados.dfc.strip() if dados.dfc is not None else d_orig
        ef_novo = dados.efolha.strip() if dados.efolha is not None else ef_orig
        st_novo = dados.status if dados.status is not None else st_orig

        # 3. Valida duplicidade contra OUTROS registros (diferentes do ID atual)
        sql_duplicado = """
            SELECT id FROM dbo.PlanoContas 
            WHERE UPPER(TRIM(planoConta)) = UPPER(?)
              AND UPPER(TRIM(grupoConta)) = UPPER(?)
              AND UPPER(TRIM(edre))       = UPPER(?)
              AND UPPER(TRIM(dfc))        = UPPER(?)
              AND UPPER(TRIM(efolha))     = UPPER(?)
              AND id <> ?
        """
        cursor.execute(sql_duplicado, (p_novo, g_novo, e_novo, d_novo, ef_novo, id))
        if cursor.fetchone():
            raise HTTPException(
                status_code=400, 
                detail="A alteração não foi salva. Já existe outro registro com essa combinação exata."
            )

        # 4. Executa o UPDATE
        sql_update = """
            UPDATE dbo.PlanoContas 
            SET planoConta = ?, grupoConta = ?, edre = ?, dfc = ?, efolha = ?, status = ?
            WHERE id = ?
        """
        cursor.execute(sql_update, (p_novo, g_novo, e_novo, d_novo, ef_novo, st_novo, id))

        # 5. Auditoria via Log
        registrar_log(
            usuario_id=usuario.id,
            acao="Edição",
            tabela="PlanoContas",
            detalhes={
                "id": id,
                "antes": {"planoConta": p_orig, "grupoConta": g_orig, "edre": e_orig, "dfc": d_orig, "efolha": ef_orig, "status": st_orig},
                "depois": {"planoConta": p_novo, "grupoConta": g_novo, "edre": e_novo, "dfc": d_novo, "efolha": ef_novo, "status": st_novo}
            },
            request=request
        )

        conexao.commit()

        return {
            "id": id,
            "planoConta": p_novo,
            "grupoConta": g_novo,
            "edre": e_novo,
            "dfc": d_novo,
            "efolha": ef_novo,
            "status": st_novo,
            "importacaoLoteId": lote_orig,
            "criadoEm": criado_em
        }

    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar plano de contas: {str(e)}")
    finally:
        conexao.close()

# 3. DELETAR (SOFT DELETE - INATIVAR)
@router.delete("/{banco}/planocontas/{id}")
async def inativar_plano_contas(
    banco: str,
    id: int,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(banco)
    cursor = conexao.cursor()
    try:
        # 1. Verifica existência
        cursor.execute("SELECT id, planoConta FROM dbo.PlanoContas WHERE id = ?", (id,))
        registro = cursor.fetchone()
        if not registro:
            raise HTTPException(status_code=404, detail="Plano de contas não encontrado.")

        # 2. Aplica o Soft Delete (status = 2)
        cursor.execute("UPDATE dbo.PlanoContas SET status = 2 WHERE id = ?", (id,))

        # 3. Registrar Log
        registrar_log(
            usuario_id=usuario.id,
            acao="Inativação",
            tabela="PlanoContas",
            detalhes={"id": id, "planoConta": registro[1], "status": 2},
            request=request
        )

        conexao.commit()
        return {"mensagem": "Plano de contas inativado com sucesso.", "id": id}

    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao inativar plano de contas: {str(e)}")
    finally:
        conexao.close()

@router.get("/{banco}/regras-planocontas")
async def obter_regras_planocontas(
    banco: str,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
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
                b.nome AS bancoNome,
                pc.planoConta AS destino,
                pc.grupoConta
            FROM PlanoDePara pdp
            INNER JOIN PlanoContas pc ON pdp.planoContaId = pc.id
            LEFT JOIN Contratante c ON pdp.contratanteId = c.id
            LEFT JOIN Unidade u ON pdp.unidadeId = u.id
            LEFT JOIN Banco b ON pdp.bancoId = b.id
            ORDER BY pdp.id DESC
        """
        dados = executar_query(sql, banco=banco)
        return dados
    except Exception as e:
        print(f"Erro no BD ao buscar regras: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no BD: {str(e)}")


@router.post("/{banco}/regras-planocontas")
async def criar_regra_planocontas(
    banco: str, 
    regra: RegraPlanoSchema, 
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    try:
        if not (regra.termoDescricao or regra.termoTipo or regra.termoFornecedor):
            raise HTTPException(
                status_code=400,
                detail="Preencha ao menos um dos campos: Descrição, Tipo ou Fornecedor."
            )

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

        registrar_log(
            usuario_id=usuario.id,
            acao="Cadastro",
            tabela="PlanoDePara",
            detalhes={
                "banco": banco,
                "dados_regra": regra.model_dump()
            },
            request=request,
        )
        
        return {"sucesso": True, "mensagem": "Regra cadastrada com sucesso!"}

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        print(f"Erro ao inserir regra: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao salvar regra: {str(e)}")


@router.put("/{banco}/regras-planocontas/{regra_id}")
async def atualizar_regra_planocontas(
    banco: str,
    regra_id: int,
    regra: RegraPlanoSchema,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    try:
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

        registrar_log(
            usuario_id=usuario.id,
            acao="Edição",
            tabela="PlanoDePara",
            detalhes={
                "banco": banco,
                "regra_id": regra_id,
                "novos_dados": regra.model_dump()
            },
            request=request,
        )

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
async def excluir_regra_planocontas(
    banco: str,
    regra_id: int,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    try:
        sql_verifica = "SELECT id FROM PlanoDePara WHERE id = ?"
        existe = executar_query(sql_verifica, banco=banco, params=(regra_id,))
        
        if not existe:
            raise HTTPException(status_code=404, detail="Regra não encontrada.")

        sql_delete = "DELETE FROM PlanoDePara WHERE id = ?"
        executar_query(sql_delete, banco=banco, params=(regra_id,))

        registrar_log(
            usuario_id=usuario.id,
            acao="Exclusão",
            tabela="PlanoDePara",
            detalhes={
                "banco": banco,
                "regra_id": regra_id
            },
            request=request,
        )
        
        return {"sucesso": True, "mensagem": "Regra excluída com sucesso!"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao excluir regra: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno no BD: {str(e)}")