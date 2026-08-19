from pydantic import BaseModel, model_validator
from typing import Optional

class RegraPlanoSchema(BaseModel):
    contratanteId: Optional[int] = None
    unidadeId: Optional[int] = None
    bancoId: Optional[int] = None
    termoDescricao: Optional[str] = None
    termoTipo: Optional[str] = None
    termoFornecedor: Optional[str] = None
    planoContaId: int
    importacaoLoteId: Optional[int] = None

    @model_validator(mode='after')
    def validar_termos(self):
        # Trata strings vazias ou compostas apenas por espaços
        desc = self.termoDescricao.strip() if self.termoDescricao and self.termoDescricao.strip() else None
        tipo = self.termoTipo.strip() if self.termoTipo and self.termoTipo.strip() else None
        forn = self.termoFornecedor.strip() if self.termoFornecedor and self.termoFornecedor.strip() else None

        # Valida se ao menos UM dos três foi informado
        if not desc and not tipo and not forn:
            raise ValueError('Preencha ao menos um dos termos: Descrição, Tipo ou Fornecedor.')

        # Atribui os valores limpos (ou None) de volta ao modelo
        self.termoDescricao = desc
        self.termoTipo = tipo
        self.termoFornecedor = forn
        return self