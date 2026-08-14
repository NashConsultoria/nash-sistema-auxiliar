from pydantic import BaseModel, model_validator
from typing import Optional

class RegraPlanoSchema(BaseModel):
    contratanteId: Optional[int] = None
    termoDescricao: Optional[str] = None
    termoFornecedor: Optional[str] = None
    planoContaId: int

    @model_validator(mode='after')
    def validar_termos(self):
        if not self.termoDescricao and not self.termoFornecedor:
            raise ValueError('Preencha ao menos um dos termos: Descrição ou Fornecedor.')
        return self