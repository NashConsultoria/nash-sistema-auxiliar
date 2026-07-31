from pydantic import BaseModel, Field
from typing import Optional

class ContratanteCreate(BaseModel):
    nome: str = Field(..., max_length=255)
    razaoSocial: Optional[str] = Field(None, max_length=255)

class ContratanteUpdate(BaseModel):
    nome: str = Field(..., max_length=255)
    razaoSocial: Optional[str] = Field(None, max_length=255)
    status: int = Field(..., description="1 para Ativo, 2 para Inativo")