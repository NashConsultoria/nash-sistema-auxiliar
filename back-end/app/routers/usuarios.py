from fastapi import APIRouter, Depends, HTTPException, Request, status
import pyodbc

from app.config import (
    BANCO_AUTENTICACAO,
    PERFIL_ADMIN,
    PERFIL_CLIENTE,
    PERFIL_FUNCIONARIO,
)
from app.database import obter_conexao
from app.schemas.usuarios_schema import (
    UsuarioCriar,
    UsuarioEditar,
    UsuarioToken,
    VincularContratante,
)
from app.security import (
    exigir_perfil,
    gerar_hash_senha,
    obter_usuario_atual,
    registrar_log,
)

router = APIRouter(prefix="/api/usuarios", tags=["Usuários"])

@router.get("/")
def listar_usuarios(admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN))):
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        cursor.execute(
            """
            SELECT id, nome, email, perfil, contratanteId, CAST(status AS INT), CAST(protegido AS INT)
            FROM dbo.Usuario 
            ORDER BY nome ASC
        """
        )
        rows = cursor.fetchall()
        conexao.close()

        usuarios = []
        for r in rows:
            usuarios.append(
                {
                    "id": int(r[0]) if r[0] is not None else None,
                    "nome": str(r[1]) if r[1] is not None else "",
                    "email": str(r[2]) if r[2] is not None else "",
                    "perfil": int(r[3]) if r[3] is not None else 1,
                    "contratanteId": int(r[4]) if r[4] is not None else None,
                    "status": int(r[5]) if r[5] is not None else 1,
                    "protegido": int(r[6]) if r[6] is not None else 0,
                }
            )

        return usuarios

    except Exception as e:
        if "conexao" in locals():
            conexao.close()

        print(f"\n[ERRO NA ROTA /api/usuarios]: {str(e)}\n")

        raise HTTPException(
            status_code=500, detail=f"Erro interno no servidor: {str(e)}"
        )


@router.post("/", status_code=status.HTTP_201_CREATED)
def cadastrar_usuario(
    dados: UsuarioCriar,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    if dados.perfil == PERFIL_CLIENTE and not dados.contratanteId:
        conexao.close()
        raise HTTPException(
            status_code=400,
            detail="Usuário com perfil 'Cliente' precisa estar vinculado a um contratante.",
        )

    cursor.execute(
        "SELECT id FROM dbo.Usuario WHERE UPPER(TRIM(email)) = UPPER(TRIM(?))",
        (dados.email,),
    )
    if cursor.fetchone():
        conexao.close()
        raise HTTPException(
            status_code=400, detail="Este e-mail já está cadastrado."
        )

    contratante_final = (
        dados.contratanteId if dados.perfil == PERFIL_CLIENTE else None
    )
    senha_criptografada = gerar_hash_senha(dados.senha)

    novo_id = None
    try:
        cursor.execute(
            """
            INSERT INTO dbo.Usuario (nome, email, senha, perfil, contratanteId, status)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, 1)
        """,
            (
                dados.nome,
                dados.email,
                senha_criptografada,
                dados.perfil,
                contratante_final,
            ),
        )

        row = cursor.fetchone()
        if row:
            novo_id = int(row[0])

        conexao.commit()

    except pyodbc.IntegrityError:
        conexao.rollback()
        conexao.close()
        raise HTTPException(
            status_code=400,
            detail="O contratante selecionado é inválido ou não existe.",
        )
    except Exception as e:
        conexao.rollback()
        conexao.close()
        raise HTTPException(
            status_code=500, detail=f"Erro ao salvar no banco: {str(e)}"
        )
    finally:
        if "conexao" in locals() and conexao:
            conexao.close()

    if novo_id:
        registrar_log(
            usuario_id=admin.id,
            acao="Cadastrar",
            tabela="Usuario",
            detalhes={
                "usuario_criado_id": novo_id,
                "nome": dados.nome,
                "email": dados.email,
                "perfil": dados.perfil,
                "contratanteId": contratante_final,
            },
            request=request,
        )

    return {"detail": "Usuário cadastrado com sucesso!"}


@router.put("/{usuario_id}")
def editar_usuario(
    usuario_id: int,
    dados: UsuarioEditar,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    try:
        cursor.execute(
            "SELECT perfil, senha, protegido FROM dbo.Usuario WHERE id = ?",
            (usuario_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=404, detail="Usuário não encontrado."
            )

        perfil_atual, senha_atual_hash, protegido = row[0], row[1], row[2]

        if int(usuario_id) == int(admin.id) and dados.perfil != perfil_atual:
            raise HTTPException(
                status_code=400,
                detail="Você não pode alterar o seu próprio tipo de perfil.",
            )

        if int(usuario_id) == 1 and dados.perfil != perfil_atual:
            raise HTTPException(
                status_code=400,
                detail="O perfil do Administrador Supremo não pode ser alterado.",
            )

        if protegido == 1 and int(usuario_id) != int(admin.id):
            raise HTTPException(
                status_code=403,
                detail="Este usuário é protegido pelo sistema e não pode ser editado.",
            )

        if dados.perfil not in (
            PERFIL_ADMIN,
            PERFIL_FUNCIONARIO,
            PERFIL_CLIENTE,
        ):
            raise HTTPException(status_code=400, detail="Perfil inválido.")

        if dados.perfil == PERFIL_CLIENTE and not dados.contratanteId:
            raise HTTPException(
                status_code=400,
                detail="Cliente precisa estar vinculado a um contratante.",
            )

        cursor.execute(
            """
            SELECT id FROM dbo.Usuario 
            WHERE UPPER(TRIM(email)) = UPPER(TRIM(?)) AND id <> ?
        """,
            (dados.email, usuario_id),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Este e-mail já está cadastrado em outro usuário.",
            )

        contratante_final = (
            dados.contratanteId if dados.perfil == PERFIL_CLIENTE else None
        )
        senha_hash = (
            gerar_hash_senha(dados.senha) if dados.senha else senha_atual_hash
        )

        cursor.execute(
            """
            UPDATE dbo.Usuario
            SET nome = ?, email = ?, senha = ?, perfil = ?, contratanteId = ?, status = ?
            WHERE id = ?
        """,
            (
                dados.nome,
                dados.email,
                senha_hash,
                dados.perfil,
                contratante_final,
                dados.status,
                usuario_id,
            ),
        )

        conexao.commit()

    except HTTPException as http_err:
        raise http_err
    except pyodbc.IntegrityError:
        conexao.rollback()
        raise HTTPException(
            status_code=409,
            detail="Este e-mail ou vínculo de contratante gerou um conflito no banco.",
        )
    except Exception as e:
        conexao.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro inesperado ao atualizar usuário: {str(e)}",
        )
    finally:
        if "conexao" in locals() and conexao:
            conexao.close()

    registrar_log(
        usuario_id=admin.id,
        acao="Editar",
        tabela="Usuario",
        detalhes={
            "usuario_editado_id": usuario_id,
            "nome": dados.nome,
            "perfil": dados.perfil,
            "status": dados.status,
            "contratanteId": contratante_final,
        },
        request=request,
    )

    return {"detail": "Usuário atualizado com sucesso."}


@router.delete("/{usuario_id}")
def excluir_usuario_logico(
    usuario_id: int,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    if usuario_id == 1:
        raise HTTPException(
            status_code=400,
            detail="O Administrador Supremo não pode ser desativado.",
        )

    if usuario_id == admin.id:
        raise HTTPException(
            status_code=400, detail="Você não pode desativar sua própria conta."
        )

    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    try:
        cursor.execute(
            "UPDATE dbo.Usuario SET status = 2 WHERE id = ?", (usuario_id,)
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404, detail="Usuário não encontrado."
            )

        conexao.commit()
    finally:
        conexao.close()

    registrar_log(
        usuario_id=admin.id,
        acao="Alterar Status",
        tabela="Usuario",
        detalhes={"usuario_desativado_id": usuario_id},
        request=request,
    )

    return {"detail": "Usuário desativado com sucesso!"}


@router.get("/{usuario_id}/contratantes")
def listar_contratantes_vinculados(
    usuario_id: int,
    usuario_logado: UsuarioToken = Depends(obter_usuario_atual),
):

    if usuario_logado.perfil != 1 and usuario_logado.id != usuario_id:
        raise HTTPException(
            status_code=403,
            detail="Você não tem permissão para ver os vínculos de outro usuário.",
        )

    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    try:
        cursor.execute(
            """
            SELECT c.id, c.nome 
            FROM dbo.Contratante c
            INNER JOIN dbo.UsuarioContratante uc ON c.id = uc.contratanteId
            WHERE uc.usuarioId = ?
            ORDER BY c.nome
        """,
            (usuario_id,),
        )

        colunas = [col[0] for col in cursor.description]
        contratantes = [dict(zip(colunas, row)) for row in cursor.fetchall()]

        return contratantes
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao buscar contratantes vinculados: {str(e)}",
        )
    finally:
        conexao.close()


@router.post("/{usuario_id}/contratantes")
def vincular_contratante(
    usuario_id: int,
    dados: VincularContratante,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    try:
        cursor.execute(
            """
            SELECT 1 FROM dbo.UsuarioContratante 
            WHERE usuarioId = ? AND contratanteId = ?
        """,
            (usuario_id, dados.contratanteId),
        )

        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="Este contratante já está vinculado a este funcionário.",
            )

        cursor.execute(
            """
            INSERT INTO dbo.UsuarioContratante (usuarioId, contratanteId)
            VALUES (?, ?)
        """,
            (usuario_id, dados.contratanteId),
        )

        conexao.commit()

        registrar_log(
            usuario_id=admin.id,
            acao="Vincular",
            tabela="UsuarioContratante",
            detalhes={
                "funcionario_id": usuario_id,
                "contratante_id": dados.contratanteId,
            },
            request=request,
        )

        return {"detail": "Contratante vinculado com sucesso!"}
    except pyodbc.Error as err:
        conexao.rollback()
        raise HTTPException(
            status_code=500, detail=f"Erro no banco de dados: {str(err)}"
        )
    except Exception as e:
        conexao.rollback()
        raise e
    finally:
        conexao.close()


@router.delete("/{usuario_id}/contratantes/{contratante_id}")
def remover_vinculo_contratante(
    usuario_id: int,
    contratante_id: int,
    request: Request,
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM dbo.UsuarioContratante
            WHERE usuarioId = ? AND contratanteId = ?
        """,
            (usuario_id, contratante_id),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404, detail="Vínculo não encontrado."
            )

        conexao.commit()

        registrar_log(
            usuario_id=admin.id,
            acao="Desvincular",
            tabela="UsuarioContratante",
            detalhes={
                "funcionario_id": usuario_id,
                "contratante_id": contratante_id,
            },
            request=request,
        )

        return {"detail": "Vínculo removido com sucesso!"}
    except Exception as e:
        conexao.rollback()
        raise HTTPException(
            status_code=500, detail=f"Erro ao remover vínculo: {str(e)}"
        )
    finally:
        conexao.close()