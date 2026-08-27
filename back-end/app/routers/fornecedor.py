from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List

from app.database import obter_conexao
from app.security import exigir_perfil, registrar_log
from app.schemas.usuarios_schema import UsuarioToken
from app.schemas.fornecedor_schema import FornecedorCreate, FornecedorUpdate, FornecedorResponse
from app.config import BANCO_AUTENTICACAO, PERFIL_ADMIN, PERFIL_FUNCIONARIO

router = APIRouter(prefix="/api/fornecedor", tags=["Fornecedor"])

# 1. LISTAR FORNECEDOR
@router.get("", response_model=List[FornecedorResponse])
async def listar_fornecedor(
    apenas_ativos: bool = False, 
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        sql = "SELECT id, nome, cpfCnpj, status FROM dbo.Fornecedor"
        if apenas_ativos:
            sql += " WHERE status = 1"
        
        # Corrigido: ordenação apenas pelas colunas existentes na tabela
        sql += " ORDER BY nome ASC"

        cursor.execute(sql)
        rows = cursor.fetchall()
        
        return [
            {
                "id": row[0], 
                "nome": row[1] or "", 
                "cpfCnpj": row[2], 
                "status": int(row[3])
            } 
            for row in rows
        ]
    finally:
        conexao.close()

# 2. CRIAR FORNECEDOR
@router.post("", response_model=FornecedorResponse, status_code=status.HTTP_201_CREATED)
async def criar_Fornecedor(
    dados: FornecedorCreate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        nome_limpo = dados.nome.strip()
        cpf_cnpj_limpo = dados.cpfCnpj.strip() if dados.cpfCnpj else None

        cursor.execute(
            """
            INSERT INTO dbo.Fornecedor (nome, cpfCnpj, status) 
            OUTPUT INSERTED.id 
            VALUES (?, ?, 1)
            """,
            (nome_limpo, cpf_cnpj_limpo)
        )
        novo_id = int(cursor.fetchone()[0])

        registrar_log(
            usuario_id=usuario.id,
            acao="Cadastro",
            tabela="Fornecedor",
            detalhes={"id": novo_id, "nome": nome_limpo, "cpfCnpj": cpf_cnpj_limpo, "status": 1},
            request=request
        )
        conexao.commit()
        
        return {
            "id": novo_id, 
            "nome": nome_limpo, 
            "cpfCnpj": cpf_cnpj_limpo, 
            "status": 1
        }
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cadastrar fornecedor: {str(e)}")
    finally:
        conexao.close()

# 3. ATUALIZAR FORNECEDOR
@router.put("/{fornecedor_id}", response_model=FornecedorResponse)
async def atualizar_fornecedor(
    fornecedor_id: int,
    dados: FornecedorUpdate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id, nome, cpfCnpj, status FROM dbo.Fornecedor WHERE id = ?", (fornecedor_id,))
        row_existente = cursor.fetchone()
        if not row_existente:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

        nome_atual = row_existente[1]
        cpfCnpj_atual = row_existente[2]
        status_atual = row_existente[3]

        # 1. Ajuste no tratamento das strings
        novo_nome = dados.nome.strip() if dados.nome and dados.nome.strip() else nome_atual
        
        # Se dados.cpfCnpj foi enviado na requisição (inclusive se for string vazia ou None)
        if dados.cpfCnpj is not None:
            novo_cpfCnpj = dados.cpfCnpj.strip() if dados.cpfCnpj.strip() else None
        else:
            novo_cpfCnpj = cpfCnpj_atual

        novo_status = dados.status if dados.status is not None else status_atual

        # 2. Valida duplicidade de nome com outro id
        if dados.nome:
            cursor.execute(
                "SELECT id FROM dbo.Fornecedor WHERE UPPER(nome) = UPPER(?) AND id <> ?", 
                (novo_nome, fornecedor_id)
            )
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Já existe outro fornecedor com este nome.")

        # 3. Query UPDATE corrigida com os nomes reais das colunas
        cursor.execute(
            """
            UPDATE dbo.Fornecedor 
            SET nome = ?, cpfCnpj = ?, status = ? 
            WHERE id = ?
            """, 
            (novo_nome, novo_cpfCnpj, novo_status, fornecedor_id)
        )

        registrar_log(
            usuario_id=usuario.id,
            acao="Edição",
            tabela="Fornecedor",
            detalhes={"id": fornecedor_id, "nome": novo_nome, "cpfCnpj": novo_cpfCnpj, "status": novo_status},
            request=request
        )
        conexao.commit()
        
        return { "id": fornecedor_id, "nome": novo_nome, "cpfCnpj": novo_cpfCnpj, "status": novo_status }
    
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar fornecedor: {str(e)}")
    finally:
        conexao.close()

# 4. ALTERAR STATUS (INATIVAR / REATIVAR)
@router.patch("/{fornecedor_id}/status")
async def alterar_status_fornecedor(
    fornecedor_id: int,
    ativo: bool,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("SELECT id FROM dbo.Fornecedor WHERE id = ?", (fornecedor_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

        # Regra do seu banco: 1 = Ativo, 2 = Inativo
        novo_status = 1 if ativo else 2
        cursor.execute("UPDATE dbo.Fornecedor SET status = ? WHERE id = ?", (novo_status, fornecedor_id))

        registrar_log(
            usuario_id=usuario.id,
            acao="AlteracaoStatus",
            tabela="Fornecedor",
            detalhes={"id": fornecedor_id, "novo_status": "Ativo" if ativo else "Inativo"},
            request=request
        )
        conexao.commit()
        return {"sucesso": True, "mensagem": f"Fornecedor {'ativado' if ativo else 'inativado'} com sucesso!"}
        
    except HTTPException as http_err:
        conexao.rollback()
        raise http_err
    except Exception as e:
        conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao alterar status do fornecedor: {str(e)}")
    finally:
        conexao.close()