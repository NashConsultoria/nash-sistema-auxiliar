from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.config import BANCO_AUTENTICACAO
from app.database import obter_conexao
from app.schemas.usuarios_schema import UsuarioToken
from app.security import (
    criar_token,
    obter_usuario_atual,
    registrar_log,
    verificar_senha,
)

router = APIRouter(prefix="/api", tags=["Autenticação"])

@router.post("/login")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    conexao = None
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        cursor.execute(
            """
            SELECT u.id, u.nome, u.email, u.senha, u.perfil, u.contratanteId, u.status, u.protegido, c.nome AS nome_contratante
            FROM dbo.Usuario u
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
            WHERE UPPER(RTRIM(LTRIM(u.email))) = UPPER(RTRIM(LTRIM(?)))
        """,
            (form_data.username,),
        )
        row = cursor.fetchone()

        erro_login = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos.",
        )

        if not row:
            raise erro_login

        (
            usuario_id,
            nome,
            email,
            senha_hash,
            perfil,
            contratante_id,
            status_usuario,
            protegido,
            nome_contratante,
        ) = row

        if status_usuario != 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário inativo. Contate o administrador.",
            )

        if not verificar_senha(form_data.password, senha_hash):
            raise erro_login

        token = criar_token(
            {
                "id": usuario_id,
                "nome": nome,
                "email": email,
                "perfil": perfil,
                "contratanteId": contratante_id,
                "nome_contratante": str(nome_contratante).strip()
                if nome_contratante
                else None,
                "protegido": protegido,
            }
        )

        # Tenta gravar o log, garantindo que falhas de log não travem o login do usuário
        try:
            registrar_log(
                usuario_id=usuario_id,
                acao="Login",
                tabela="usuarios",
                detalhes={"email": email},
                request=request,
            )
        except Exception as e_log:
            print(f"[AVISO] Não foi possível registrar o log de login: {e_log}")

        return {
            "access_token": token,
            "token_type": "bearer",
            "id": usuario_id,
            "nome": nome,
            "email": email,
            "perfil": perfil,
            "contratanteId": contratante_id,
            "nome_contratante": str(nome_contratante).strip()
            if nome_contratante
            else None,
            "protegido": protegido,
        }

    finally:
        if conexao:
            conexao.close()


@router.get("/me")
def quem_sou_eu(usuario: UsuarioToken = Depends(obter_usuario_atual)):
    return usuario