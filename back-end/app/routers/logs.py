import json
from fastapi import APIRouter, Depends, HTTPException

from app.config import BANCO_AUTENTICACAO
from app.database import obter_conexao
from app.schemas.usuarios import UsuarioToken
from app.security import exigir_perfil

router = APIRouter(prefix="/api/logs", tags=["Logs & Auditoria"])

@router.get("")
def listar_logs_usuarios(admin: UsuarioToken = Depends(exigir_perfil(1))):
    """Retorna o histórico de ações realizadas no sistema (Apenas para Administradores)"""
    conexao = obter_conexao(BANCO_AUTENTICACAO)
    cursor = conexao.cursor()
    try:
        cursor.execute(
            """
            SELECT 
                l.id,
                l.usuarioId,
                u.nome AS usuario_nome,
                u.email AS usuario_email,
                l.acao,
                l.tabela,
                l.detalhes,
                CONVERT(VARCHAR(19), l.criadoEm, 120) AS criadoEm
            FROM dbo.LogUsuario l
            INNER JOIN dbo.Usuario u ON l.usuarioId = u.id
            ORDER BY l.criadoEm DESC
        """
        )

        rows = cursor.fetchall()
        logs = []
        for r in rows:
            # Tenta decodificar o JSON de detalhes salvo como string
            detalhes_formatados = None
            if r[6]:
                try:
                    detalhes_formatados = json.loads(r[6])
                except Exception:
                    detalhes_formatados = r[6]

            logs.append(
                {
                    "id": int(r[0]),
                    "usuario_id": int(r[1]),
                    "usuario_nome": str(r[2]),
                    "usuario_email": str(r[3]),
                    "acao": str(r[4]),
                    "tabela": str(r[5]) if r[5] else None,
                    "detalhes": detalhes_formatados,
                    "criado_em": str(r[7]),
                }
            )
        return logs
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao carregar logs: {str(e)}"
        )
    finally:
        conexao.close()