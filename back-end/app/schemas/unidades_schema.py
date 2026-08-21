from typing import Optional
from pydantic import BaseModel, Field

class UnidadeCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255, description="Nome Fantasia / Identificação da Unidade")
    razaoSocial: Optional[str] = Field(None, max_length=255, description="Razão Social da Unidade")
    cnpj: Optional[str] = Field(None, max_length=20, description="CNPJ da Unidade")
    contratanteId: int = Field(..., gt=0, description="ID da empresa contratante vinculada (Obrigatório)")
    tipo: int = Field(1, description="1 para Registro, 2 para Atuação, 3 para Ambos")
    status: int = Field(1, description="1 para Ativo, 2 para Inativo")

class UnidadeUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    razaoSocial: Optional[str] = Field(None, max_length=255)
    cnpj: Optional[str] = Field(None, max_length=20)
    contratanteId: Optional[int] = Field(None, gt=0)
    tipo: Optional[int] = Field(None, description="1 para Registro, 2 para Atuação, 3 para Ambos")
    status: Optional[int] = Field(None, description="1 para Ativo, 2 para Inativo")

class UnidadeResponse(BaseModel):
    id: int
    nome: str
    razaoSocial: Optional[str] = None
    cnpj: Optional[str] = None
    contratanteId: int 
    tipo: int
    status: int

    class Config:
        from_attributes = True