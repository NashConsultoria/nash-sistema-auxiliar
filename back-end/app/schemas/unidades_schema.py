from typing import Optional
from pydantic import BaseModel, Field

class UnidadeCreate(BaseModel):
    nome: str
    razaoSocial: Optional[str] = None
    cnpj: Optional[str] = None
    contratanteId: int
    bancoId: Optional[int] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    tipo: int = 1
    status: int = 1

class UnidadeUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    razaoSocial: Optional[str] = Field(None, max_length=255)
    cnpj: Optional[str] = Field(None, max_length=20)
    contratanteId: Optional[int] = Field(None, gt=0)
    bancoId: Optional[int] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    tipo: Optional[int] = Field(None, description="1 para Registro, 2 para Atuação, 3 para Ambos")
    status: Optional[int] = Field(None, description="1 para Ativo, 2 para Inativo")

class UnidadeResponse(BaseModel):
    id: int
    nome: str
    razaoSocial: Optional[str] = None
    cnpj: Optional[str] = None
    contratanteId: int 
    bancoContaId: Optional[int] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    banco: Optional[str] = None
    tipo: int
    status: int

    class Config:
        from_attributes = True