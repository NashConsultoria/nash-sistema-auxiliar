from pydantic import BaseModel, EmailStr
from typing import Optional

class UsuarioCriar(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    perfil: int
    contratanteId: Optional[int] = None

class UsuarioEditar(BaseModel):
    nome: str
    email: EmailStr
    senha: Optional[str] = None
    perfil: int
    contratanteId: Optional[int] = None
    status: Optional[int] = 1

class UsuarioToken(BaseModel):
    id: int
    nome: str
    email: str
    perfil: int
    contratanteId: Optional[int] = None
    nome_contratante: Optional[str] = None
    protegido: Optional[int] = 0

class VincularContratante(BaseModel):
    contratanteId: int