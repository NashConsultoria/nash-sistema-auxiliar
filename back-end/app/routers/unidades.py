from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List

from app.database import obter_conexao
from app.security import exigir_perfil, registrar_log
from app.schemas.usuarios_schema import UsuarioToken
from app.schemas.unidades_schema import UnidadeCreate, UnidadeUpdate, UnidadeResponse
from app.config import BANCO_AUTENTICACAO, PERFIL_ADMIN, PERFIL_FUNCIONARIO

router = APIRouter(prefix="/api/unidades", tags=["Unidades"])

# 1. LISTAR UNIDADES
@router.get("", response_model=List[UnidadeResponse])
async def listar_unidades(
    apenas_ativas: bool = False,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        sql = """
            SELECT 
                u.id, 
                u.nome, 
                u.razaoSocial, 
                u.cnpj, 
                u.contratanteId, 
                u.bancoContaId, 
                u.tipo, 
                u.status,
                bc.agencia, 
                bc.conta, 
                b.nome
            FROM dbo.Unidade u
            LEFT JOIN dbo.BancoConta bc ON u.bancoContaId = bc.id
            LEFT JOIN dbo.Banco b ON bc.bancoId = b.id
        """
        
        if apenas_ativas:
            sql += " WHERE u.status = 1"

        sql += " ORDER BY u.nome ASC"

        cursor.execute(sql)
        rows = cursor.fetchall()

        return [
            {
                "id": row[0],
                "nome": row[1],
                "razaoSocial": row[2],
                "cnpj": row[3],
                "contratanteId": row[4],
                "bancoContaId": row[5],
                "tipo": int(row[6]),
                "status": int(row[7]),
                "agencia": row[8],
                "conta": row[9],
                "banco": row[10]
            }
            for row in rows
        ]
    finally:
        conexao.close()

# 2. CRIAR UNIDADE
@router.post("", response_model=UnidadeResponse, status_code=status.HTTP_201_CREATED)
async def criar_unidade(
    dados: UnidadeCreate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        nome_limpo = dados.nome.strip()
        razao_limpa = dados.razaoSocial.strip() if dados.razaoSocial else None
        cnpj_limpo = dados.cnpj.strip() if dados.cnpj else None
        agencia_limpa = dados.agencia.strip() if dados.agencia else None
        conta_limpa = dados.conta.strip() if dados.conta else None

        # 1. Valida duplicidade de nome
        cursor.execute("SELECT id FROM dbo.Unidade WHERE UPPER(nome) = UPPER(?)", (nome_limpo,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Já existe uma unidade com este nome.")

        # 2. Valida existência do Contratante
        cursor.execute("SELECT id FROM dbo.Contratante WHERE id = ?", (dados.contratanteId,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Contratante informado não existe.")

        # 3. Trata a Conta Bancária (Busca ou Criação)
        banco_conta_id = None
        banco_nome = None

        if dados.bancoId and agencia_limpa and conta_limpa:
            # Valida existência do Banco e pega o nome dele
            cursor.execute("SELECT id, nome FROM dbo.Banco WHERE id = ?", (dados.bancoId,))
            banco_row = cursor.fetchone()
            if not banco_row:
                raise HTTPException(status_code=400, detail="Banco informado não existe.")
            banco_nome = banco_row[1]

            # Verifica se essa conta bancária já existe
            cursor.execute(
                """
                SELECT id FROM dbo.BancoConta 
                WHERE bancoId = ? AND agencia = ? AND conta = ?
                """,
                (dados.bancoId, agencia_limpa, conta_limpa)
            )
            conta_row = cursor.fetchone()

            if conta_row:
                banco_conta_id = conta_row[0]
            else:
                # Cria a conta bancária para reuso futuro
                cursor.execute(
                    """
                    INSERT INTO dbo.BancoConta (bancoId, agencia, conta)
                    OUTPUT INSERTED.id
                    VALUES (?, ?, ?)
                    """,
                    (dados.bancoId, agencia_limpa, conta_limpa)
                )
                banco_conta_id = int(cursor.fetchone()[0])

        # 4. Insere a Unidade
        cursor.execute(
            """
            INSERT INTO dbo.Unidade (nome, razaoSocial, cnpj, contratanteId, bancoContaId, tipo, status)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (nome_limpo, razao_limpa, cnpj_limpo, dados.contratanteId, banco_conta_id, dados.tipo, dados.status)
        )
        novo_id = int(cursor.fetchone()[0])

        registrar_log(
            usuario_id=usuario.id,
            acao="Cadastro",
            tabela="Unidade",
            detalhes={"id": novo_id, "nome": nome_limpo, "contratanteId": dados.contratanteId},
            request=request
        )
        conexao.commit()

        return {
            "id": novo_id,
            "nome": nome_limpo,
            "razaoSocial": razao_limpa,
            "cnpj": cnpj_limpo,
            "contratanteId": dados.contratanteId,
            "bancoContaId": banco_conta_id,
            "agencia": agencia_limpa,
            "conta": conta_limpa,
            "banco": banco_nome,
            "tipo": dados.tipo,
            "status": dados.status
        }
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cadastrar unidade: {str(e)}")
    finally:
        conexao.close()

# 3. ATUALIZAR UNIDADE
@router.put("/{unidade_id}", response_model=UnidadeResponse)
async def atualizar_unidade(
    unidade_id: int,
    dados: UnidadeUpdate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id, nome, razaoSocial, cnpj, contratanteId, bancoContaId, tipo, status FROM dbo.Unidade WHERE id = ?", (unidade_id,))
        row_existente = cursor.fetchone()
        if not row_existente:
            raise HTTPException(status_code=404, detail="Unidade não encontrada.")

        nome_atual, razao_atual, cnpj_atual, contratante_atual, bancoConta_atual, tipo_atual, status_atual = (
            row_existente[1], row_existente[2], row_existente[3], row_existente[4], row_existente[5], row_existente[6], row_existente[7]
        )

        novo_nome = dados.nome.strip() if dados.nome else nome_atual
        nova_razao = dados.razaoSocial.strip() if dados.razaoSocial is not None else razao_atual
        novo_cnpj = dados.cnpj.strip() if dados.cnpj is not None else cnpj_atual
        novo_contratante = dados.contratanteId if dados.contratanteId is not None else contratante_atual
        novo_tipo = dados.tipo if dados.tipo is not None else tipo_atual
        novo_status = dados.status if dados.status is not None else status_atual

        if novo_contratante is None:
            raise HTTPException(status_code=400, detail="A unidade deve possuir um contratante vinculado.")

        # Validações de Nome e Contratante
        if dados.nome:
            cursor.execute("SELECT id FROM dbo.Unidade WHERE UPPER(nome) = UPPER(?) AND id <> ?", (novo_nome, unidade_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Já existe outra unidade cadastrada com este nome.")

        if dados.contratanteId is not None:
            cursor.execute("SELECT id FROM dbo.Contratante WHERE id = ?", (novo_contratante,))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="Contratante informado não existe.")

        # --- TRATAMENTO DA CONTA BANCÁRIA ---
        novo_banco_conta_id = bancoConta_atual
        agencia_limpa = dados.agencia.strip() if dados.agencia else None
        conta_limpa = dados.conta.strip() if dados.conta else None
        banco_nome = None

        if dados.bancoId and agencia_limpa and conta_limpa:
            # Valida o Banco informado
            cursor.execute("SELECT id, nome FROM dbo.Banco WHERE id = ?", (dados.bancoId,))
            banco_row = cursor.fetchone()
            if not banco_row:
                raise HTTPException(status_code=400, detail="Banco informado não existe.")
            banco_nome = banco_row[1]

            if bancoConta_atual:
                # ATUALIZA a conta existente vinculada a esta unidade
                cursor.execute(
                    """
                    UPDATE dbo.BancoConta 
                    SET bancoId = ?, agencia = ?, conta = ?
                    WHERE id = ?
                    """,
                    (dados.bancoId, agencia_limpa, conta_limpa, bancoConta_atual)
                )
                novo_banco_conta_id = bancoConta_atual
            else:
                # CRIA a conta se a unidade não possuía conta cadastrada anteriormente
                cursor.execute(
                    """
                    INSERT INTO dbo.BancoConta (bancoId, agencia, conta)
                    OUTPUT INSERTED.id
                    VALUES (?, ?, ?)
                    """,
                    (dados.bancoId, agencia_limpa, conta_limpa)
                )
                novo_banco_conta_id = int(cursor.fetchone()[0])

        elif bancoConta_atual:
            # Mantém os dados bancários atuais se nenhum dado de banco for alterado
            cursor.execute(
                """
                SELECT bc.agencia, bc.conta, b.nome 
                FROM dbo.BancoConta bc
                LEFT JOIN dbo.Banco b ON bc.bancoId = b.id
                WHERE bc.id = ?
                """,
                (bancoConta_atual,)
            )
            bc_row = cursor.fetchone()
            if bc_row:
                agencia_limpa, conta_limpa, banco_nome = bc_row[0], bc_row[1], bc_row[2]

        # Atualiza a Unidade
        cursor.execute(
            """
            UPDATE dbo.Unidade 
            SET nome = ?, razaoSocial = ?, cnpj = ?, contratanteId = ?, bancoContaId = ?, tipo = ?, status = ?
            WHERE id = ?
            """,
            (novo_nome, nova_razao, novo_cnpj, novo_contratante, novo_banco_conta_id, novo_tipo, novo_status, unidade_id)
        )

        registrar_log(
            usuario_id=usuario.id,
            acao="Edição",
            tabela="Unidade",
            detalhes={"id": unidade_id, "novo_nome": novo_nome, "novo_contratante": novo_contratante, "novo_status": novo_status},
            request=request
        )
        conexao.commit()

        return {
            "id": unidade_id,
            "nome": novo_nome,
            "razaoSocial": nova_razao,
            "cnpj": novo_cnpj,
            "contratanteId": novo_contratante,
            "bancoContaId": novo_banco_conta_id,
            "agencia": agencia_limpa,
            "conta": conta_limpa,
            "banco": banco_nome,
            "tipo": novo_tipo,
            "status": novo_status
        }
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar unidade: {str(e)}")
    finally:
        conexao.close()

# 4. ALTERAR STATUS (PATCH)
@router.patch("/{unidade_id}/status")
async def alternar_status_unidade(
    unidade_id: int,
    ativo: bool,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id, nome FROM dbo.Unidade WHERE id = ?", (unidade_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Unidade não encontrada.")

        novo_status = 1 if ativo else 2
        cursor.execute("UPDATE dbo.Unidade SET status = ? WHERE id = ?", (novo_status, unidade_id))

        registrar_log(
            usuario_id=usuario.id,
            acao="Alteração de Status",
            tabela="Unidade",
            detalhes={"id": unidade_id, "novo_status": novo_status},
            request=request
        )
        conexao.commit()
        return {"mensagem": f"Unidade {'ativada' if ativo else 'inativada'} com sucesso."}
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao alterar status da unidade: {str(e)}")
    finally:
        conexao.close()