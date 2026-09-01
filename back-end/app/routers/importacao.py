from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.config import PERFIL_ADMIN
from app.schemas.usuarios_schema import UsuarioToken
from app.security import exigir_perfil
from app.services.importacao_service import (
    importacao_base_financeira,
    importacao_folha_pagamento,
    importacao_contratantes,
    importacao_plano_contas,
    importacao_banco,
    importacao_unidade,
    importacao_fornecedor,
    importacao_regra_fornecedor,
    importacao_regra_plano,
)

router = APIRouter(prefix="/api", tags=["Importação"])


@router.post("/importar-arquivo")
async def importar_arquivo_generico(
    request: Request,
    file: UploadFile = File(...),
    admin: UsuarioToken = Depends(exigir_perfil(PERFIL_ADMIN)),
):
    conteudo = await file.read()
    nome_arquivo_lower = file.filename.lower()

    if (
            "mapa_contratantes" in nome_arquivo_lower
        ):
            return importacao_contratantes(
                conteudo_arquivo=conteudo,
                nome_arquivo=file.filename,
                usuario_id=admin.id,
                request=request,
            )

    if (
        "plano_contas" in nome_arquivo_lower
    ):
        return importacao_plano_contas(
            conteudo_arquivo=conteudo,
            nome_arquivo=file.filename,
            usuario_id=admin.id,
            request=request,
        )

    if (
            "mapa_bancos" in nome_arquivo_lower
        ):
            return importacao_banco(
                conteudo_arquivo=conteudo,
                nome_arquivo=file.filename,
                usuario_id=admin.id,
                request=request,
            )

    if (
            "mapa_unidades" in nome_arquivo_lower
        ):
            return importacao_unidade(
                conteudo_arquivo=conteudo,
                nome_arquivo=file.filename,
                usuario_id=admin.id,
                request=request,
            )

    if (
        "mapa_fornecedor" in nome_arquivo_lower
    ):
        return importacao_fornecedor(
            conteudo_arquivo=conteudo,
            nome_arquivo=file.filename,
            usuario_id=admin.id,
            request=request,
        )

    if (
            "regras_fornecedor" in nome_arquivo_lower
        ):
            return importacao_regra_fornecedor(
                conteudo_arquivo=conteudo,
                nome_arquivo=file.filename,
                usuario_id=admin.id,
                request=request,
            )

    if (
            "regras_plano" in nome_arquivo_lower
        ):
            return importacao_regra_plano(
                conteudo_arquivo=conteudo,
                nome_arquivo=file.filename,
                usuario_id=admin.id,
                request=request,
            )

    if (
        "folha_pagamento" in nome_arquivo_lower
    ):
        return await importacao_folha_pagamento(
            conteudo=conteudo,
            nome_arquivo=file.filename,
            usuario=admin,
            request=request,
        )

    if (
        "base_financeira" in nome_arquivo_lower
    ):
        return await importacao_base_financeira(
            conteudo=conteudo,
            nome_arquivo=file.filename,
            usuario=admin,
            request=request,
        )