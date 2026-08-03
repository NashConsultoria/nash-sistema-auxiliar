import os
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "TROQUE-ISSO-POR-UMA-CHAVE-LONGA-E-ALEATORIA-DE-VERDADE")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

BANCO_AUTENTICACAO = "NashBancoConsultoria"

CONEXAO_BASE = (
    "Driver={ODBC Driver 17 for SQL Server};"
    "Server=localhost;"
    "Trusted_Connection=yes;"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

PERFIL_ADMIN = 1
PERFIL_FUNCIONARIO = 2
PERFIL_CLIENTE = 3

ORDEM_DRE = {
    "RECEITA OPERACIONAL BRUTA": 1,
    "DEDUÇÃO DA RECEITA": 2,
    "CUSTO OPERACIONAL": 3,
    "DESP. OPERACIONAL": 4,
    "RETIRADA SÓCIOS": 5,
    "MOV. NÃO OPERACIONAL": 6
}

ORDEM_EFOLHA = {
    "PROVENTOS": 1,
    "PROVISÃO DA FOLHA": 2,
    "ENCARGOS PATRONAIS": 3,
    "BENEFÍCIOS AO COLABORADOR": 4,
    "APOIO AO COLABORADOR": 5,
    "DESCONTOS FOLHA": 6,
}

TABELAS_PERMITIDAS = {
    "planocontas": {
        "query_customizada": "SELECT id, planoConta, grupoConta, edre, dfc, efolha, criadoEm FROM dbo.PlanoContas",
        "coluna_padrao_id": "id"
    },
    "movimentacao": {
        "query_customizada": """
            SELECT 
                m.id,
                c.nome AS CONTRATANTE,
                u.nome AS UNIDADE,
                bc.banco AS BANCO,
                bc.agencia AS AGENCIA,
                bc.conta AS CONTA,
                m.data AS DATA,
                m.descricao AS DESCRICAO,
                m.obs AS OBSERVACAO,
                m.valor AS VALOR,
                m.tipo AS TIPO,
                f.nome AS FORNECEDOR,
                f.cpf_cnpj AS CPF_CNPJ,
                p.planoConta AS [PLANO DE CONTA],
                m.importacaoLoteId
            FROM dbo.Movimentacao m
            LEFT JOIN dbo.Unidade u ON m.unidadeId = u.id
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
            LEFT JOIN dbo.BancoConta bc ON m.bancoContaId = bc.id
            LEFT JOIN dbo.Fornecedor f ON m.fornecedorId = f.id
            LEFT JOIN dbo.PlanoContas p ON m.planoContaId = p.id
        """,
        "coluna_padrao_id": "importacaoLoteId"
    },
    "movimentacaofolhapagamento": {
        "query_customizada": """
            SELECT 
                m.id,
                c.nome AS [CONTRATANTE],
                u_reg.nome AS [UNIDADE REGISTRO],
                u_atu.nome AS [UNIDADE ATUACAO],
                u_reg.cnpj AS [CNPJ],
                m.nome AS [NOME],
                m.cpf AS [CPF],
                m.dataNascimento AS [DATA NASCIMENTO],
                m.cboCargo AS [CBO CARGO],
                m.cargo AS [CARGO],
                m.departamento AS [DEPARTAMENTO],
                m.dataAdmissao AS [DATA ADMISSAO],
                m.descricao AS [DESCRICAO],
                p.planoConta AS [PLANO DE CONTA],
                p.grupoConta AS [GRUPO DE CONTA],
                p.efolha AS [E-FOLHA],
                m.dataCompetencia AS [DATA COMPETENCIA],
                m.dataCaixa AS [DATA CAIXA],
                m.tipo AS [TIPO],
                m.valor AS [VALOR],
                m.importacaoLoteId
            FROM dbo.MovimentacaoFolhaPagamento m
            LEFT JOIN dbo.Unidade u_reg ON m.unidadeRegistroId = u_reg.id
            LEFT JOIN dbo.Unidade u_atu ON m.unidadeAtuacaoId = u_atu.id
            LEFT JOIN dbo.Contratante c ON u_reg.contratanteId = c.id
            LEFT JOIN dbo.PlanoContas p ON m.planoContaId = p.id
        """,
        "coluna_padrao_id": "importacaoLoteId"
    },
}