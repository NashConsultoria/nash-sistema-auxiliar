from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Schema Base com campos compartilhados
class PlanoContasBase(BaseModel):
    planoConta: str
    grupoConta: str
    edre: str
    dfc: str
    efolha: str
    status: int = 1  # 1: Ativo, 2: Inativo
    importacaoLoteId: Optional[int] = None

# Schema para criação via POST (sem ID ou criadoEm)
class PlanoContasCreate(PlanoContasBase):
    pass

# Schema para atualização via PUT/PATCH (campos opcionais)
class PlanoContasUpdate(BaseModel):
    planoConta: Optional[str] = None
    grupoConta: Optional[str] = None
    edre: Optional[str] = None
    dfc: Optional[str] = None
    efolha: Optional[str] = None
    status: Optional[int] = None
    importacaoLoteId: Optional[int] = None

# Schema de retorno/resposta da API (inclui ID e criadoEm)
class PlanoContasResponse(PlanoContasBase):
    id: int
    criadoEm: Optional[datetime] = None

    class Config:
        from_attributes = True  # Permite conversão de objetos ORM (SQLAlchemy)