from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.config import BANCO_AUTENTICACAO
from app.schemas.usuarios import UsuarioToken
from app.security import exigir_perfil
from app.services.importacao_service import (
    processar_importacao_movimentacoes,
    processar_importacao_movimentacoes_folha,
    processar_importacao_plano_contas,
)

router = APIRouter(prefix="/api", tags=["Importação"])


@router.post("/importar-arquivo")
async def importar_arquivo_generico(
    request: Request,
    file: UploadFile = File(...),
    admin: UsuarioToken = Depends(exigir_perfil(1)),
):
    conteudo = await file.read()
    nome_arquivo_lower = file.filename.lower()

    if (
        "plano" in nome_arquivo_lower
        or "plano_contas" in nome_arquivo_lower
        or "base_plano" in nome_arquivo_lower
    ):
        return processar_importacao_plano_contas(
            conteudo_arquivo=conteudo,
            nome_arquivo=file.filename,
            usuario_id=admin.id,
            request=request,
        )

    if (
        "folha" in nome_arquivo_lower
        or "folha_pagamento" in nome_arquivo_lower
        or "base_folha" in nome_arquivo_lower
    ):
        return await processar_importacao_movimentacoes_folha(
            conteudo=conteudo,
            nome_arquivo=file.filename,
            banco=BANCO_AUTENTICACAO,
            usuario=admin,
            request=request,
        )

    return await processar_importacao_movimentacoes(
        conteudo=conteudo,
        nome_arquivo=file.filename,
        banco=BANCO_AUTENTICACAO,
        usuario=admin,
        request=request,
    )