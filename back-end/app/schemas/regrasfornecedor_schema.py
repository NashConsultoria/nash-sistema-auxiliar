from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional

class RegraFornecedorCreate(BaseModel):
    termoDescricao: Optional[str] = None
    termoTipo: Optional[str] = None
    fornecedorId: int
    prioridade: int = 0
    importacaoLoteId: Optional[int] = None

    @model_validator(mode='after')
    def validar_termos(self):
        desc = self.termoDescricao.strip() if self.termoDescricao and self.termoDescricao.strip() else None
        tipo = self.termoTipo.strip() if self.termoTipo and self.termoTipo.strip() else None

        if not desc and not tipo:
            raise ValueError('Preencha ao menos um dos termos: Descrição ou Tipo.')

        self.termoDescricao = desc
        self.termoTipo = tipo
        return self


class RegraFornecedorUpdate(BaseModel):
    termoDescricao: Optional[str] = None
    termoTipo: Optional[str] = None
    fornecedorId: Optional[int] = None
    prioridade: Optional[int] = None

    @model_validator(mode='after')
    def validar_termos(self):
        if self.termoDescricao is not None:
            self.termoDescricao = self.termoDescricao.strip() or None
        if self.termoTipo is not None:
            self.termoTipo = self.termoTipo.strip() or None
        return self


class RegraFornecedorResponse(BaseModel):
    id: int
    termoDescricao: Optional[str] = None
    termoTipo: Optional[str] = None
    fornecedorId: int
    nomeFornecedor: Optional[str] = None
    prioridade: int = 0
    importacaoLoteId: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)