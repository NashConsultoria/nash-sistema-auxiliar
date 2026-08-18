from pydantic import BaseModel, model_validator
from typing import Optional

class RegraPlanoSchema(BaseModel):
    contratanteId: Optional[int] = None
    unidadeId: Optional[int] = None
    bancoId: Optional[int] = None
    termoDescricao: Optional[str] = None
    termoFornecedor: Optional[str] = None
    planoContaId: int
    importacaoLoteId: Optional[int] = None

    @model_validator(mode='after')
    def validar_termos(self):
        desc = self.termoDescricao.strip() if self.termoDescricao else None
        forn = self.termoFornecedor.strip() if self.termoFornecedor else None

        if not desc and not forn:
            raise ValueError('Preencha ao menos um dos termos: Descrição ou Fornecedor.')

        self.termoDescricao = desc
        self.termoFornecedor = forn
        return self