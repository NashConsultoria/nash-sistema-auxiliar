from fastapi import APIRouter, Depends, HTTPException, Request

from app.schemas.usuarios_schema import UsuarioToken
from app.schemas.contratantes_schema import ContratanteCreate, ContratanteUpdate
from app.config import BANCO_AUTENTICACAO, PERFIL_ADMIN, PERFIL_FUNCIONARIO
from app.database import obter_conexao
from app.security import exigir_perfil, registrar_log

router = APIRouter(prefix="/api/contratantes", tags=["Contratantes"])

@router.get("")
def listar_contratantes(admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))):
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        cursor.execute(
            "SELECT id, nome, razaoSocial, status FROM dbo.Contratante ORDER BY nome ASC"
        )
        rows = cursor.fetchall()

        lista = []
        for r in rows:
            lista.append(
                {
                    "id": int(r[0]),
                    "nome": str(r[1]).strip(),
                    "razaoSocial": str(r[2]).strip() if r[2] else "",
                    "status": int(r[3]),
                }
            )

        conexao.close()
        return lista

    except Exception as e:
        if "conexao" in locals():
            conexao.close()
        print(f"\n[ERRO] Falha em GET /api/contratantes: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def criar_contratante(
    dados: ContratanteCreate,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    nome_limpo = dados.nome.strip()
    razao_limpa = (
        dados.razaoSocial.strip()
        if dados.razaoSocial and dados.razaoSocial.strip()
        else None
    )
    contratante_id = None

    try:
        # 1. Validação de Duplicidade
        if razao_limpa:
            query_valida = """
                SELECT id FROM dbo.Contratante 
                WHERE UPPER(TRIM(nome)) = UPPER(?) OR UPPER(TRIM(razaoSocial)) = UPPER(?)
            """
            cursor.execute(query_valida, (nome_limpo, razao_limpa))
        else:
            query_valida = (
                "SELECT id FROM dbo.Contratante WHERE UPPER(TRIM(nome)) = UPPER(?)"
            )
            cursor.execute(query_valida, (nome_limpo,))

        if cursor.fetchone():
            raise HTTPException(
                status_code=400, detail="Nome ou Razão Social já cadastrados."
            )

        # 2. Inserção
        cursor.execute(
            """
            INSERT INTO dbo.Contratante (nome, razaoSocial, status) 
            OUTPUT INSERTED.id
            VALUES (?, ?, 1)
        """,
            (nome_limpo, razao_limpa),
        )

        contratante_id = cursor.fetchone()[0]
        conexao.commit()

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        conexao.rollback()
        print(f"\n[ERRO] Falha em POST /api/contratantes: {str(e)}\n")
        raise HTTPException(
            status_code=500, detail=f"Erro ao cadastrar contratante: {str(e)}"
        )
    finally:
        conexao.close()

    # Log gravado após liberar o banco
    if contratante_id:
        registrar_log(
            usuario_id=admin.id,
            acao="Cadastrar",
            tabela="Contratante",
            detalhes={
                "id": contratante_id,
                "nome": nome_limpo,
                "razaoSocial": razao_limpa,
            },
            request=request,
        )

    return {"sucesso": True, "mensagem": "Contratante cadastrado com sucesso!"}

@router.put("/{id}")
def atualizar_contratante(
    id: int,
    dados: ContratanteUpdate,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    nome_limpo = dados.nome.strip()
    razao_limpa = (
        dados.razaoSocial.strip()
        if dados.razaoSocial and dados.razaoSocial.strip()
        else None
    )

    try:
        # Check de existência
        cursor.execute("SELECT id FROM dbo.Contratante WHERE id = ?", (id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=404, detail="Contratante não encontrado."
            )

        # Check de duplicidade ignorando a si próprio
        if razao_limpa:
            query_valida = """
                SELECT id FROM dbo.Contratante 
                WHERE (UPPER(TRIM(nome)) = UPPER(?) OR UPPER(TRIM(razaoSocial)) = UPPER(?)) AND id <> ?
            """
            cursor.execute(query_valida, (nome_limpo, razao_limpa, id))
        else:
            query_valida = "SELECT id FROM dbo.Contratante WHERE UPPER(TRIM(nome)) = UPPER(?) AND id <> ?"
            cursor.execute(query_valida, (nome_limpo, id))

        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Nome ou Razão Social já estão sendo usados por outra empresa.",
            )

        # Update
        cursor.execute(
            """
            UPDATE dbo.Contratante 
            SET nome = ?, razaoSocial = ?, status = ? 
            WHERE id = ?
        """,
            (nome_limpo, razao_limpa, dados.status, id),
        )

        conexao.commit()

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        conexao.rollback()
        print(f"\n[ERRO] Falha em PUT /api/contratantes: {str(e)}\n")
        raise HTTPException(
            status_code=500, detail=f"Erro ao atualizar contratante: {str(e)}"
        )
    finally:
        conexao.close()

    # Log fora da conexão
    registrar_log(
        usuario_id=admin.id,
        acao="Editar",
        tabela="Contratante",
        detalhes={
            "id": id,
            "nome": nome_limpo,
            "razaoSocial": razao_limpa,
            "status": dados.status,
        },
        request=request,
    )

    return {"sucesso": True, "mensagem": "Contratante atualizado com sucesso!"}

@router.delete("/{id}")
def inativar_contratante(
    id: int, request: Request, admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    nome_contratante = None

    try:
        cursor.execute("SELECT nome FROM dbo.Contratante WHERE id = ?", (id,))
        contratante = cursor.fetchone()

        if not contratante:
            raise HTTPException(
                status_code=404, detail="Contratante não encontrado."
            )

        nome_contratante = contratante[0]

        cursor.execute("UPDATE dbo.Contratante SET status = 2 WHERE id = ?", (id,))
        conexao.commit()

    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        conexao.rollback()
        print(f"\n[ERRO] Falha ao inativar contratante: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conexao.close()

    registrar_log(
        usuario_id=admin.id,
        acao="Atualizar Status",
        tabela="Contratante",
        detalhes={
            "id": id,
            "nome": nome_contratante,
            "acaoTomada": "Inativação de Contratante",
        },
        request=request,
    )

    return {"sucesso": True, "mensagem": "Contratante inativado com sucesso!"}