from datetime import datetime, timedelta
import json
import secrets
from typing import Optional
import bcrypt
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt

from app.config import PERFIL_ADMIN, oauth2_scheme, BANCO_AUTENTICACAO
from app.database import obter_conexao
from app.schemas.usuarios import UsuarioToken

# Constantes de Segurança / Configuração
SECRET_KEY = "SUA_CHAVE_SECRETA_AQUI"  # Garanta que esta chave venha de variável de ambiente ou config
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 dia
ALGORITHM = "HS256"


def gerar_hash_senha(senha_plana: str) -> str:
    return bcrypt.hashpw(senha_plana.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )

def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha_plana.encode("utf-8"), senha_hash.encode("utf-8"))

def criar_token(dados: dict) -> str:
    to_encode = dados.copy()
    expira = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expira})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def obter_usuario_atual(token: str = Depends(oauth2_scheme)) -> UsuarioToken:
    credenciais_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return UsuarioToken(**payload)
    except JWTError:
        raise credenciais_invalidas

def exigir_perfil(*perfis_permitidos: int):
    """Uso: Depends(exigir_perfil(PERFIL_ADMIN, PERFIL_FUNCIONARIO))"""

    def verificador(
        usuario: UsuarioToken = Depends(obter_usuario_atual),
    ) -> UsuarioToken:
        if usuario.perfil not in perfis_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para acessar este recurso.",
            )
        return usuario

    return verificador

def verificar_acesso_contratante(
    usuario_token: UsuarioToken, contratante_id: int, cursor
):
    # 1. Se for Admin (perfil 1) ou Protegido, acesso liberado de imediato
    if usuario_token.perfil == 1 or getattr(usuario_token, "protegido", 0) == 1:
        return True

    # 2. Se for Funcionário (perfil 2), verifica se o vínculo existe no banco
    cursor.execute(
        """
        SELECT 1 FROM dbo.UsuarioContratante 
        WHERE usuarioId = ? AND contratanteId = ?
    """,
        (usuario_token.id, contratante_id),
    )

    if not cursor.fetchone():
        raise HTTPException(
            status_code=403,
            detail="Você não tem permissão para acessar os dados deste contratante.",
        )

def registrar_log(
    usuario_id: int,
    acao: str,
    tabela: Optional[str] = None,
    detalhes: Optional[dict] = None,
    ip: Optional[str] = None,
    request: Optional[Request] = None,
):
    """Insere um novo registro de atividade na tabela LogUsuario"""
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        if request:
            x_forwarded = request.headers.get("x-forwarded-for")
            if x_forwarded:
                ip_final = x_forwarded.split(",")[0].strip()
            else:
                ip_final = request.client.host if request.client else "127.0.0.1"
        else:
            ip_final = ip or "127.0.0.1"

        detalhes_json = (
            json.dumps(detalhes, ensure_ascii=False) if detalhes else None
        )

        cursor.execute(
            """
            INSERT INTO dbo.LogUsuario (usuarioId, acao, tabela, detalhes, ip, criadoEm)
            VALUES (?, ?, ?, ?, ?, GETDATE())
        """,
            (usuario_id, acao, tabela, detalhes_json, ip_final),
        )

        conexao.commit()
    except Exception as e:
        print(f"[ERRO AO GRAVAR LOG]: {str(e)}")
    finally:
        conexao.close()

def criar_admin_padrao_se_necessario():
    """Função executada na inicialização do servidor para garantir que haja ao menos 1 admin."""
    try:
        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()
        cursor.execute("SELECT COUNT(*) FROM dbo.Usuario")
        total_usuarios = cursor.fetchone()[0]

        if total_usuarios == 0:
            senha_gerada = secrets.token_urlsafe(12)
            senha_hash = gerar_hash_senha(senha_gerada)

            cursor.execute(
                """
                INSERT INTO dbo.Usuario (nome, email, senha, perfil, contratanteId, status, protegido)
                VALUES (?, ?, ?, ?, NULL, 1, 1)
            """,
                (
                    "Administrador Padrão",
                    "admin@hotmail.com",
                    senha_hash,
                    PERFIL_ADMIN,
                ),
            )
            conexao.commit()

            print("=" * 60)
            print("NENHUM USUÁRIO ENCONTRADO — ADMIN PADRÃO CRIADO")
            print("  Email: admin@hotmail.com")
            print(f"  Senha: {senha_gerada}")
            print("  Guarde essa senha agora — ela não aparece de novo.")
            print("=" * 60)

        conexao.close()
    except Exception as e:
        print(f"[AVISO] Não foi possível verificar/criar admin padrão: {e}")