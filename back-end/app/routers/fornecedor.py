from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List, Optional

from app.database import obter_conexao
from app.security import exigir_perfil, registrar_log
from app.schemas.usuarios_schema import UsuarioToken
from app.schemas.fornecedor_schema import FornecedorCreate, FornecedorUpdate, FornecedorResponse
from app.schemas.regrasfornecedor_schema import RegraFornecedorCreate, RegraFornecedorUpdate, RegraFornecedorResponse
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

@router.get("/regras", response_model=List[RegraFornecedorResponse])
def listar_regras_fornecedor(
    fornecedor_id: Optional[int] = None,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = None
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        query = """
            SELECT 
                rf.id,
                rf.termoDescricao,
                rf.termoTipo,
                rf.fornecedorId,
                f.nome AS nomeFornecedor,
                rf.importacaoLoteId
            FROM dbo.FornecedorRegras rf
            INNER JOIN dbo.Fornecedor f ON rf.fornecedorId = f.id
            WHERE 1=1
        """
        params = []

        if fornecedor_id:
            query += " AND rf.fornecedorId = ?"
            params.append(fornecedor_id)

        query += " ORDER BY rf.id DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        resultado = [
            RegraFornecedorResponse(
                id=row[0],
                termoDescricao=row[1],
                termoTipo=row[2],
                fornecedorId=row[3],
                nomeFornecedor=row[4],
                importacaoLoteId=row[5]
            )
            for row in rows
        ]

        return resultado

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar regras de fornecedor: {str(e)}"
        )
    finally:
        if conexao:
            conexao.close()

@router.post("/regras", response_model=RegraFornecedorResponse, status_code=status.HTTP_201_CREATED)
def criar_regra_fornecedor(
    dados: RegraFornecedorCreate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = None
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # Valida existência do fornecedor
        cursor.execute("SELECT id, nome FROM dbo.Fornecedor WHERE id = ?", (dados.fornecedorId,))
        fornecedor = cursor.fetchone()
        if not fornecedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fornecedor com ID {dados.fornecedorId} não encontrado."
            )

        # Inserção na tabela
        query_insert = """
            INSERT INTO dbo.FornecedorRegras (termoDescricao, termoTipo, fornecedorId, importacaoLoteId)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?)
        """
        cursor.execute(query_insert, (
            dados.termoDescricao,
            dados.termoTipo,
            dados.fornecedorId,
            dados.importacaoLoteId
        ))
        novo_id = cursor.fetchone()[0]

        conexao.commit()

        # Log de Auditoria
        registrar_log(
            usuario_id=usuario.id,
            acao="CRIAR_REGRA_FORNECEDOR",
            tabela="FornecedorRegras",
            detalhes={"id": novo_id, "fornecedorId": dados.fornecedorId},
            request=request
        )

        return RegraFornecedorResponse(
            id=novo_id,
            termoDescricao=dados.termoDescricao,
            termoTipo=dados.termoTipo,
            fornecedorId=dados.fornecedorId,
            nomeFornecedor=fornecedor[1],
            importacaoLoteId=dados.importacaoLoteId
        )

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar regra de fornecedor: {str(e)}"
        )
    finally:
        if conexao:
            conexao.close()

@router.put("/regras/{regra_id}", response_model=RegraFornecedorResponse)
def atualizar_regra_fornecedor(
    regra_id: int,
    dados: RegraFornecedorUpdate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = None
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # Busca registro atual
        cursor.execute("""
            SELECT id, termoDescricao, termoTipo, fornecedorId, importacaoLoteId 
            FROM dbo.FornecedorRegras WHERE id = ?
        """, (regra_id,))
        regra_atual = cursor.fetchone()

        if not regra_atual:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Regra de fornecedor ID {regra_id} não encontrada."
            )

        # 1. Verifica quais campos foram ENVIADOS no JSON da requisição
        campos_enviados = dados.model_fields_set

        # 2. Se o campo foi enviado no JSON (mesmo que vazio/None), usa o novo valor.
        # Caso não tenha sido enviado no payload, mantém o valor antigo do banco.
        nova_descricao = dados.termoDescricao if "termoDescricao" in campos_enviados else regra_atual[1]
        novo_tipo = dados.termoTipo if "termoTipo" in campos_enviados else regra_atual[2]
        novo_fornecedor_id = dados.fornecedorId if "fornecedorId" in campos_enviados else regra_atual[3]

        # Validação de regra de negócio: pelo menos um termo preenchido
        if not nova_descricao and not novo_tipo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A regra precisa ter pelo menos 'termoDescricao' ou 'termoTipo' preenchido."
            )

        # Valida existência do novo fornecedor (caso alterado)
        cursor.execute("SELECT nome FROM dbo.Fornecedor WHERE id = ?", (novo_fornecedor_id,))
        row_fornecedor = cursor.fetchone()
        if not row_fornecedor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fornecedor com ID {novo_fornecedor_id} não encontrado."
            )

        # Atualiza o registro salvando os novos valores (incluindo NULL no banco se apagado)
        query_update = """
            UPDATE dbo.FornecedorRegras
            SET termoDescricao = ?, termoTipo = ?, fornecedorId = ?
            WHERE id = ?
        """
        cursor.execute(query_update, (nova_descricao, novo_tipo, novo_fornecedor_id, regra_id))
        conexao.commit()

        # Log de Auditoria
        registrar_log(
            usuario_id=usuario.id,
            acao="ATUALIZAR_REGRA_FORNECEDOR",
            tabela="FornecedorRegras",
            detalhes={"id": regra_id, "fornecedorId": novo_fornecedor_id},
            request=request
        )

        return RegraFornecedorResponse(
            id=regra_id,
            termoDescricao=nova_descricao,
            termoTipo=novo_tipo,
            fornecedorId=novo_fornecedor_id,
            nomeFornecedor=row_fornecedor[0],
            importacaoLoteId=regra_atual[4]
        )

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar regra de fornecedor: {str(e)}"
        )
    finally:
        if conexao:
            conexao.close()


@router.delete("/regras/{regra_id}", status_code=status.HTTP_200_OK)
def deletar_regra_fornecedor(
    regra_id: int,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = None
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # Verifica existência
        cursor.execute("SELECT id FROM dbo.FornecedorRegras WHERE id = ?", (regra_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Regra de fornecedor ID {regra_id} não encontrada."
            )

        cursor.execute("DELETE FROM dbo.FornecedorRegras WHERE id = ?", (regra_id,))
        conexao.commit()

        # Log de Auditoria
        registrar_log(
            usuario_id=usuario.id,
            acao="DELETAR_REGRA_FORNECEDOR",
            tabela="FornecedorRegras",
            detalhes={"id": regra_id},
            request=request
        )

        return {"sucesso": True, "mensagem": f"Regra #{regra_id} excluída com sucesso."}

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao excluir regra de fornecedor: {str(e)}"
        )
    finally:
        if conexao:
            conexao.close()