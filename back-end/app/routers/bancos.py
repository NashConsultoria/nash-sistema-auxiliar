from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List

from app.database import obter_conexao
from app.security import exigir_perfil, registrar_log
from app.schemas.usuarios_schema import UsuarioToken
from app.schemas.bancos_schema import BancoCreate, BancoUpdate, BancoResponse
from app.config import BANCO_AUTENTICACAO, PERFIL_ADMIN, PERFIL_FUNCIONARIO

router = APIRouter(prefix="/api/bancos", tags=["Bancos"])

# 1. LISTAR BANCOS
@router.get("", response_model=List[BancoResponse])
async def listar_bancos(apenas_ativos: bool = False, usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        sql = "SELECT id, nome, status FROM dbo.Banco"
        if apenas_ativos:
            sql += " WHERE status = 1"
        sql += " ORDER BY nome ASC"

        cursor.execute(sql)
        rows = cursor.fetchall()
        return [{"id": row[0], "nome": row[1], "status": int(row[2])} for row in rows]
    finally:
        conexao.close()

# 2. CRIAR BANCO
@router.post("", response_model=BancoResponse, status_code=status.HTTP_201_CREATED)
async def criar_banco(
    dados: BancoCreate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        nome_limpo = dados.nome.strip()
        
        # Verifica duplicidade
        cursor.execute("SELECT id FROM dbo.Banco WHERE UPPER(nome) = UPPER(?)", (nome_limpo,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Banco com este nome já está cadastrado.")

        cursor.execute(
            "INSERT INTO dbo.Banco (nome, status) OUTPUT INSERTED.id VALUES (?, 1)",
            (nome_limpo,)
        )
        novo_id = int(cursor.fetchone()[0])

        registrar_log(
            usuario_id=usuario.id,
            acao="Cadastro",
            tabela="Banco",
            detalhes={"id": novo_id, "nome": nome_limpo, "status": 1},
            request=request
        )
        conexao.commit()
        return {"id": novo_id, "nome": nome_limpo, "status": 1}
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cadastrar banco: {str(e)}")
    finally:
        conexao.close()

# 3. ATUALIZAR BANCO
@router.put("/{banco_id}", response_model=BancoResponse)
async def atualizar_banco(
    banco_id: int,
    dados: BancoUpdate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id, status FROM dbo.Banco WHERE id = ?", (banco_id,))
        row_existente = cursor.fetchone()
        if not row_existente:
            raise HTTPException(status_code=404, detail="Banco não encontrado.")

        status_atual = row_existente[1]
        nome_limpo = dados.nome.strip() if dados.nome else None
        
        if nome_limpo:
            cursor.execute("SELECT id FROM dbo.Banco WHERE UPPER(nome) = UPPER(?) AND id <> ?", (nome_limpo, banco_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Já existe outro banco com este nome.")

            novo_status = dados.status if dados.status is not None else status_atual
            cursor.execute("UPDATE dbo.Banco SET nome = ?, status = ? WHERE id = ?", (nome_limpo, novo_status, banco_id))

        registrar_log(
            usuario_id=usuario.id,
            acao="Edição",
            tabela="Banco",
            detalhes={"id": banco_id, "novo_nome": nome_limpo},
            request=request
        )
        conexao.commit()
        return {"id": banco_id, "nome": nome_limpo, "status": dados.status if dados.status is not None else status_atual}
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar banco: {str(e)}")
    finally:
        conexao.close()

# 4. ALTERAR STATUS (INATIVAR / REATIVAR)
@router.patch("/{banco_id}/status")
async def alterar_status_banco(
    banco_id: int,
    ativo: bool,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id FROM dbo.Banco WHERE id = ?", (banco_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Banco não encontrado.")

        # Converte para a regra da sua tabela: 1 = Ativo, 2 = Inativo
        novo_status = 1 if ativo else 2
        cursor.execute("UPDATE dbo.Banco SET status = ? WHERE id = ?", (novo_status, banco_id))

        registrar_log(
            usuario_id=usuario.id,
            acao="AlteracaoStatus",
            tabela="Banco",
            detalhes={"id": banco_id, "novo_status": "Ativo" if ativo else "Inativo"},
            request=request
        )
        conexao.commit()
        return {"sucesso": True, "mensagem": f"Banco {'ativado' if ativo else 'inativado'} com sucesso!"}
    finally:
        conexao.close()