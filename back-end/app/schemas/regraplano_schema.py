from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional

class RegraPlanoSchema(BaseModel):
    contratanteId: Optional[int] = None
    unidadeId: Optional[int] = None
    bancoId: Optional[int] = None
    termoDescricao: Optional[str] = None
    termoTipo: Optional[str] = None
    fornecedorId: Optional[int] = None
    planoContaId: int
    importacaoLoteId: Optional[int] = None

    @model_validator(mode='after')
    def validar_termos(self):
        # Trata strings vazias ou compostas apenas por espaços
        desc = self.termoDescricao.strip() if self.termoDescricao and self.termoDescricao.strip() else None
        tipo = self.termoTipo.strip() if self.termoTipo and self.termoTipo.strip() else None
        forn_id = self.fornecedorId if self.fornecedorId and self.fornecedorId > 0 else None

        # Valida se ao menos UM dos três critérios foi informado
        if not desc and not tipo and not forn_id:
            raise ValueError('Preencha ao menos um dos critérios: Descrição, Tipo ou selecione um Fornecedor.')

        # Atribui os valores limpos de volta ao modelo
        self.termoDescricao = desc
        self.termoTipo = tipo
        self.fornecedorId = forn_id
        return self

# Schemas complementares para Response e Update
class RegraPlanoUpdate(BaseModel):
    contratanteId: Optional[int] = None
    unidadeId: Optional[int] = None
    bancoId: Optional[int] = None
    termoDescricao: Optional[str] = None
    termoTipo: Optional[str] = None
    fornecedorId: Optional[int] = None
    planoContaId: Optional[int] = None

class RegraPlanoResponse(RegraPlanoSchema):
    id: int
    nomeContratante: Optional[str] = None
    nomeUnidade: Optional[str] = None
    nomeBanco: Optional[str] = None
    nomeFornecedor: Optional[str] = None
    codigoPlanoConta: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)