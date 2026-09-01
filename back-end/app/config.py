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
    "contratante": {
        "nome_aba": "MAPA_CONTRATANTES",
        "query_customizada": """
            SELECT
                c.importacaoLoteId,
                c.nome AS NOME,
                c.razaoSocial AS RAZAO SOCIAL
            FROM dbo.Contratante c
        """
    },
    "planocontas": {
        "query_customizada": """
            SELECT 
                id, 
                planoConta AS [PLANO DE CONTAS],
                grupoConta AS [GRUPO DE CONTAS],
                edre AS EDRE,
                dfc AS DFC,
                efolha AS EFOLHA,
                criadoEm 
            FROM dbo.PlanoContas
        """,
        "nome_aba": "PLANO_CONTA",
        "coluna_padrao_id": "id"
    },
    "unidade": {
        "nome_aba": "MAPA_UNIDADES",
        "query_customizada": """
            SELECT 
                u.importacaoLoteId,
                c.nome AS CONTRATANTE,
                u.nome AS NOME,
                u.razaoSocial AS [RAZAO SOCIAL],
                u.cnpj AS CNPJ,
                u.tipo AS TIPO
            FROM dbo.Unidade u
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
        """
    },
    "banco": {
        "nome_aba": "MAPA_BANCOS",
        "query_customizada": """
            SELECT
                b.importacaoLoteId,
                b.codigo AS CODIGO,
                b.nome AS BANCO
            FROM dbo.Banco b
        """
    },
    "fornecedor": {
        "query_customizada": """
            SELECT 
                id, 
                nome AS [FORNECEDOR], 
                cpfCnpj AS [CPF-CNPJ],
                CASE WHEN status = 1 THEN 'Ativo' ELSE 'Inativo' END AS [STATUS],
                importacaoLoteId
            FROM dbo.Fornecedor
        """,
        "nome_aba": "MAPA_FORNECEDOR",
        "coluna_padrao_id": "id"
    },
    "fornecedorregras": {
        "query_customizada": """
            SELECT 
                fr.termoDescricao AS [DESCRICAO],
                fr.termoTipo AS [TIPO],
                f.nome AS [FORNECEDOR],
                fr.importacaoLoteId
            FROM dbo.FornecedorRegras fr
            LEFT JOIN dbo.Fornecedor f ON fr.fornecedorId = f.id
        """,
        "nome_aba": "Regras_Fornecedor"
    },
    "planodepara": {
        "query_customizada": """
            SELECT 
                p.id, 
                p.importacaoLoteId, 
                c.nome AS [CONTRATANTE], 
                u.nome AS [UNIDADE], 
                b.nome AS [BANCO],
                p.termoDescricao AS [DESCRICAO], 
                p.termoTipo AS [TIPO],
                f.nome AS [FORNECEDOR], 
                pc.planoConta AS [PLANO DE CONTA] 
            FROM dbo.PlanoDePara p LEFT JOIN dbo.Contratante c ON p.contratanteId = c.id 
            LEFT JOIN dbo.Unidade u ON p.unidadeId = u.id 
            LEFT JOIN dbo.Banco b ON p.bancoId = b.id 
            LEFT JOIN dbo.Fornecedor f on p.fornecedorId = f.id
            LEFT JOIN dbo.PlanoContas pc ON p.planoContaId = pc.id
        """,
        "nome_aba": "Regras_Plano",
        "coluna_padrao_id": "importacaoLoteId"
    },
    "basefinanceiro": {
        "query_customizada": """
            SELECT 
                m.id,
                c.nome AS CONTRATANTE,
                u.nome AS UNIDADE,
                b.nome AS BANCO,
                bc.agencia AS AGENCIA,
                bc.conta AS CONTA,
                CONVERT(VARCHAR(10), m.data, 103) AS DATA,
                m.descricao AS DESCRICAO,
                m.obs AS OBSERVACAO,
                m.valor AS VALOR,
                m.tipo AS TIPO,
                f.nome AS FORNECEDORES,
                p.planoConta AS [PLANO DE CONTA],
                p.grupoConta AS [GRUPO DE CONTA],
                p.edre AS [E-DRE],
                m.importacaoLoteId
            FROM dbo.BaseFinanceiro m
            LEFT JOIN dbo.ImportacaoLote l ON m.importacaoLoteId = l.id
            LEFT JOIN dbo.Contratante c ON l.contratanteId = c.id
            LEFT JOIN dbo.Unidade u ON m.unidadeId = u.id
            LEFT JOIN dbo.BancoConta bc ON m.bancoContaId = bc.id
            LEFT JOIN dbo.Banco b ON bc.bancoId = b.id
            LEFT JOIN dbo.Fornecedor f ON m.fornecedorId = f.id
            LEFT JOIN dbo.PlanoContas p ON m.planoContaId = p.id
        """,
        "nome_aba": "BASE_FINANCEIRA",
        "coluna_padrao_id": "importacaoLoteId"
    },
    "basefolhapagamento": {
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
            FROM dbo.BaseFolhaPagamento m
            LEFT JOIN dbo.Unidade u_reg ON m.unidadeRegistroId = u_reg.id
            LEFT JOIN dbo.Unidade u_atu ON m.unidadeAtuacaoId = u_atu.id
            LEFT JOIN dbo.Contratante c ON u_reg.contratanteId = c.id
            LEFT JOIN dbo.PlanoContas p ON m.planoContaId = p.id
        """,
        "nome_aba": "FOLHA_PAGAMENTO",
        "coluna_padrao_id": "importacaoLoteId"
    },
}
