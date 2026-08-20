from typing import Optional
from pydantic import BaseModel, Field

class BancoCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255, description="Nome da instituição financeira")

class BancoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[int] = Field(None, description="1 para Ativo, 2 para Inativo")

class BancoResponse(BaseModel):
    id: int
    nome: str
    status: int

    class Config:
        from_attributes = True