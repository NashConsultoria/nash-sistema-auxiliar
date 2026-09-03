from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List

from app.database import obter_conexao
from app.security import exigir_perfil, registrar_log
from app.schemas.changelog_schema import ChangeLogResponse, ChangeLogCreate
from app.schemas.usuarios_schema import UsuarioToken
from app.config import BANCO_AUTENTICACAO, PERFIL_ADMIN, PERFIL_FUNCIONARIO

router = APIRouter(prefix="/api/changelog", tags=["ChangeLog"])

@router.get("", response_model=List[ChangeLogResponse])
def listar_changelogs(
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))
):
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute("""
            SELECT 
                c.id, 
                c.versao, 
                c.titulo, 
                c.descricao, 
                c.criadoEm
            FROM dbo.ChangeLog c
            ORDER BY c.criadoEm DESC, c.id DESC
        """)
        rows = cursor.fetchall()
        return [
            ChangeLogResponse(
                id=row[0],
                versao=row[1],
                titulo=row[2],
                descricao=row[3],
                criadoEm=row[4]
            )
            for row in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar changelog: {str(e)}")
    finally:
        if conexao:
            conexao.close()

@router.post("", response_model=ChangeLogResponse, status_code=status.HTTP_201_CREATED)
def criar_changelog(
    dados: ChangeLogCreate,
    request: Request,
    usuario: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN))
):
    conexao = None
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        cursor.execute("""
            INSERT INTO dbo.ChangeLog (versao, titulo, descricao, criadoEm)
            OUTPUT INSERTED.id, INSERTED.criadoEm
            VALUES (?, ?, ?, GETDATE())
        """, (dados.versao, dados.titulo, dados.descricao))
        
        row = cursor.fetchone()

        try:
            registrar_log(
                usuario_id=usuario.id,
                acao="Cadastrar",
                tabela="ChangeLog",
                detalhes={"versao": dados.versao, "titulo": dados.titulo, "descricao": dados.descricao},
                request=request
            )
        except Exception as log_err:
            print(f"Aviso ao registrar auditoria: {log_err}")

        conexao.commit()

        return ChangeLogResponse(
            id=row[0],
            versao=dados.versao,
            titulo=dados.titulo,
            descricao=dados.descricao,
            criadoEm=row[1]
        )
    except Exception as e:
        if conexao:
            conexao.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar changelog: {str(e)}")
    finally:
        if conexao:
            conexao.close()