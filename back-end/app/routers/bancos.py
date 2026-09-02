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
async def listar_bancos(
    apenas_ativos: bool = False, 
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        sql = "SELECT id, codigo, nome, status FROM dbo.Banco"
        if apenas_ativos:
            sql += " WHERE status = 1"
        sql += " ORDER BY codigo ASC, nome ASC"

        cursor.execute(sql)
        rows = cursor.fetchall()
        return [
            {
                "id": row[0], 
                "codigo": row[1] or "", 
                "nome": row[2], 
                "status": int(row[3])
            } 
            for row in rows
        ]
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
        codigo_limpo = dados.codigo.strip()
        nome_limpo = dados.nome.strip()
        
        # Verifica duplicidade por código
        cursor.execute("SELECT id FROM dbo.Banco WHERE UPPER(codigo) = UPPER(?)", (codigo_limpo,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Banco com este código já está cadastrado.")

        cursor.execute(
            "INSERT INTO dbo.Banco (codigo, nome, status) OUTPUT INSERTED.id VALUES (?, ?, 1)",
            (codigo_limpo, nome_limpo)
        )
        novo_id = int(cursor.fetchone()[0])

        registrar_log(
            usuario_id=usuario.id,
            acao="Cadastrar",
            tabela="Banco",
            detalhes={"id": novo_id, "codigo": codigo_limpo, "nome": nome_limpo, "status": 1},
            request=request
        )
        conexao.commit()
        return {"id": novo_id, "codigo": codigo_limpo, "nome": nome_limpo, "status": 1}
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
        cursor.execute("SELECT id, codigo, nome, status FROM dbo.Banco WHERE id = ?", (banco_id,))
        row_existente = cursor.fetchone()
        if not row_existente:
            raise HTTPException(status_code=404, detail="Banco não encontrado.")

        codigo_atual = row_existente[1]
        nome_atual = row_existente[2]
        status_atual = row_existente[3]

        novo_codigo = dados.codigo.strip() if dados.codigo else codigo_atual
        novo_nome = dados.nome.strip() if dados.nome else nome_atual
        novo_status = dados.status if dados.status is not None else status_atual

        # Valida duplicidade de código com outro id
        if dados.codigo:
            cursor.execute("SELECT id FROM dbo.Banco WHERE UPPER(codigo) = UPPER(?) AND id <> ?", (novo_codigo, banco_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Já existe outro banco com este código.")

        # Valida duplicidade de nome com outro id
        if dados.nome:
            cursor.execute("SELECT id FROM dbo.Banco WHERE UPPER(nome) = UPPER(?) AND id <> ?", (novo_nome, banco_id))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Já existe outro banco com este nome.")

        cursor.execute(
            "UPDATE dbo.Banco SET codigo = ?, nome = ?, status = ? WHERE id = ?", 
            (novo_codigo, novo_nome, novo_status, banco_id)
        )

        registrar_log(
            usuario_id=usuario.id,
            acao="Editar",
            tabela="Banco",
            detalhes={"id": banco_id, "novo_codigo": novo_codigo, "novo_nome": novo_nome, "novo_status": novo_status},
            request=request
        )
        conexao.commit()
        return {"id": banco_id, "codigo": novo_codigo, "nome": novo_nome, "status": novo_status}
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
            acao="Alterar Status",
            tabela="Banco",
            detalhes={"id": banco_id, "novo_status": "Ativo" if ativo else "Inativo"},
            request=request
        )
        conexao.commit()
        return {"sucesso": True, "mensagem": f"Banco {'ativado' if ativo else 'inativado'} com sucesso!"}
    finally:
        conexao.close()