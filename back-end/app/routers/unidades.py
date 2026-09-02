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
                u.id, u.nome, u.razaoSocial, u.cnpj, u.contratanteId, u.tipo, u.status,
                bc.id AS bancoContaId, bc.agencia, bc.conta, b.nome AS bancoNome
            FROM dbo.Unidade u
            LEFT JOIN dbo.BancoConta bc ON bc.unidadeId = u.id
            LEFT JOIN dbo.Banco b ON bc.bancoId = b.id
        """
        if apenas_ativas:
            sql += " WHERE u.status = 1"

        sql += " ORDER BY u.nome ASC, bc.id ASC"
        cursor.execute(sql)
        rows = cursor.fetchall()

        return [
            {
                "id": row[0],
                "nome": row[1],
                "razaoSocial": row[2],
                "cnpj": row[3],
                "contratanteId": row[4],
                "tipo": int(row[5]),
                "status": int(row[6]),
                "bancoContaId": row[7],
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

        # 1. Valida existência do Contratante
        cursor.execute("SELECT id FROM dbo.Contratante WHERE id = ?", (dados.contratanteId,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Contratante informado não existe.")

        # 2. Verifica se a Unidade com este Nome já existe
        cursor.execute("SELECT id FROM dbo.Unidade WHERE UPPER(nome) = UPPER(?)", (nome_limpo,))
        row_unidade = cursor.fetchone()

        if row_unidade:
            unidade_id = row_unidade[0]
            cursor.execute(
                """
                UPDATE dbo.Unidade 
                SET razaoSocial = COALESCE(?, razaoSocial), 
                    cnpj = COALESCE(?, cnpj), 
                    contratanteId = ?, 
                    tipo = ?, 
                    status = ?
                WHERE id = ?
                """,
                (razao_limpa, cnpj_limpo, dados.contratanteId, dados.tipo, dados.status, unidade_id)
            )
            acao_log = "Editar"
        else:
            cursor.execute(
                """
                INSERT INTO dbo.Unidade (nome, razaoSocial, cnpj, contratanteId, tipo, status)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (nome_limpo, razao_limpa, cnpj_limpo, dados.contratanteId, dados.tipo, dados.status)
            )
            unidade_id = int(cursor.fetchone()[0])
            acao_log = "Cadastrar"

        # 3. Processa e vincula a Conta Bancária
        banco_conta_id = None
        banco_nome = None

        if dados.bancoId and conta_limpa:
            cursor.execute("SELECT id, nome FROM dbo.Banco WHERE id = ?", (dados.bancoId,))
            banco_row = cursor.fetchone()
            if not banco_row:
                raise HTTPException(status_code=400, detail="Banco informado não existe.")
            banco_nome = banco_row[1]

            cursor.execute(
                "SELECT id FROM dbo.BancoConta WHERE bancoId = ? AND ISNULL(agencia, '') = ISNULL(?, '') AND conta = ?",
                (dados.bancoId, agencia_limpa, conta_limpa)
            )
            conta_row = cursor.fetchone()

            if conta_row:
                banco_conta_id = conta_row[0]
                cursor.execute("UPDATE dbo.BancoConta SET unidadeId = ? WHERE id = ?", (unidade_id, banco_conta_id))
            else:
                cursor.execute(
                    """
                    INSERT INTO dbo.BancoConta (bancoId, agencia, conta, unidadeId)
                    OUTPUT INSERTED.id
                    VALUES (?, ?, ?, ?)
                    """,
                    (dados.bancoId, agencia_limpa, conta_limpa, unidade_id)
                )
                banco_conta_id = int(cursor.fetchone()[0])

        registrar_log(
            usuario_id=usuario.id,
            acao=acao_log,
            tabela="Unidade",
            detalhes={"id": unidade_id, "nome": nome_limpo, "bancoContaId": banco_conta_id},
            request=request
        )
        conexao.commit()

        return {
            "id": unidade_id,
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
        raise HTTPException(status_code=500, detail=f"Erro ao processar unidade: {str(e)}")
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
        # 1. Verifica existência da Unidade
        cursor.execute(
            "SELECT id, nome, razaoSocial, cnpj, contratanteId, tipo, status FROM dbo.Unidade WHERE id = ?", 
            (unidade_id,)
        )
        row_existente = cursor.fetchone()
        if not row_existente:
            raise HTTPException(status_code=404, detail="Unidade não encontrada.")

        nome_atual, razao_atual, cnpj_atual, contratante_atual, tipo_atual, status_atual = (
            row_existente[1], row_existente[2], row_existente[3], row_existente[4], row_existente[5], row_existente[6]
        )

        novo_nome = dados.nome.strip() if dados.nome else nome_atual
        nova_razao = dados.razaoSocial.strip() if dados.razaoSocial is not None else razao_atual
        novo_cnpj = dados.cnpj.strip() if dados.cnpj is not None else cnpj_atual
        novo_contratante = dados.contratanteId if dados.contratanteId is not None else contratante_atual
        novo_tipo = dados.tipo if dados.tipo is not None else tipo_atual
        novo_status = dados.status if dados.status is not None else status_atual

        if novo_contratante is None:
            raise HTTPException(status_code=400, detail="A unidade deve possuir um contratante vinculado.")

        # 2. Validações de Nome e Contratante
        if dados.nome:
            cursor.execute("SELECT id FROM dbo.Unidade WHERE UPPER(nome) = UPPER(?) AND id <> ?", (novo_nome, unidade_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Já existe outra unidade cadastrada com este nome.")

        if dados.contratanteId is not None:
            cursor.execute("SELECT id FROM dbo.Contratante WHERE id = ?", (novo_contratante,))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="Contratante informado não existe.")

        # 3. Tratamento da Conta Bancária
        agencia_limpa = dados.agencia.strip() if dados.agencia else None
        conta_limpa = dados.conta.strip() if dados.conta else None
        banco_conta_id = getattr(dados, "bancoContaId", None)  # Pega se o schema enviar
        banco_nome = None

        if dados.bancoId and conta_limpa:
            cursor.execute("SELECT id, nome FROM dbo.Banco WHERE id = ?", (dados.bancoId,))
            banco_row = cursor.fetchone()
            if not banco_row:
                raise HTTPException(status_code=400, detail="Banco informado não existe.")
            banco_nome = banco_row[1]

            # Se veio um ID de conta bancária específico para editar:
            if banco_conta_id:
                cursor.execute(
                    """
                    UPDATE dbo.BancoConta 
                    SET bancoId = ?, agencia = ?, conta = ?, unidadeId = ?
                    WHERE id = ?
                    """,
                    (dados.bancoId, agencia_limpa, conta_limpa, unidade_id, banco_conta_id)
                )
            else:
                # Se não veio ID da conta, procura se já existe uma conta igual para vincular
                cursor.execute(
                    "SELECT id FROM dbo.BancoConta WHERE bancoId = ? AND ISNULL(agencia, '') = ISNULL(?, '') AND conta = ?",
                    (dados.bancoId, agencia_limpa, conta_limpa)
                )
                conta_row = cursor.fetchone()

                if conta_row:
                    banco_conta_id = conta_row[0]
                    cursor.execute("UPDATE dbo.BancoConta SET unidadeId = ? WHERE id = ?", (unidade_id, banco_conta_id))
                else:
                    # Se for uma conta nova para a unidade, cria um novo registro
                    cursor.execute(
                        """
                        INSERT INTO dbo.BancoConta (bancoId, agencia, conta, unidadeId)
                        OUTPUT INSERTED.id
                        VALUES (?, ?, ?, ?)
                        """,
                        (dados.bancoId, agencia_limpa, conta_limpa, unidade_id)
                    )
                    banco_conta_id = int(cursor.fetchone()[0])

        # 4. Atualiza os dados da Unidade
        cursor.execute(
            """
            UPDATE dbo.Unidade 
            SET nome = ?, razaoSocial = ?, cnpj = ?, contratanteId = ?, tipo = ?, status = ?
            WHERE id = ?
            """,
            (novo_nome, nova_razao, novo_cnpj, novo_contratante, novo_tipo, novo_status, unidade_id)
        )

        registrar_log(
            usuario_id=usuario.id,
            acao="Editar",
            tabela="Unidade",
            detalhes={"id": unidade_id, "novo_nome": novo_nome, "bancoContaId": banco_conta_id},
            request=request
        )
        conexao.commit()

        return {
            "id": unidade_id,
            "nome": novo_nome,
            "razaoSocial": nova_razao,
            "cnpj": novo_cnpj,
            "contratanteId": novo_contratante,
            "bancoContaId": banco_conta_id,
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
            acao="Alterar Status",
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