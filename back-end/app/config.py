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
                p.termoFornecedor AS [FORNECEDOR], 
                pc.planoConta AS [PLANO DE CONTA] 
            FROM dbo.PlanoDePara p LEFT JOIN dbo.Contratante c ON p.contratanteId = c.id 
            LEFT JOIN dbo.Unidade u ON p.unidadeId = u.id 
            LEFT JOIN dbo.Banco b ON p.bancoId = b.id 
            LEFT JOIN dbo.PlanoContas pc ON p.planoContaId = pc.id
        """,
        "nome_aba": "Regras_Plano",
        "coluna_padrao_id": "importacaoLoteId"
    },
    "BaseFinanceiro": {
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
                f.nome AS FORNECEDORES,
                f.cpf_cnpj AS CPF_CNPJ,
                p.planoConta AS [PLANO DE CONTA],
                p.grupoConta AS [GRUPO DE CONTA],
                p.edre AS [E-DRE],
                m.importacaoLoteId
            FROM dbo.BaseFinanceiro m
            LEFT JOIN dbo.Unidade u ON m.unidadeId = u.id
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
            LEFT JOIN dbo.BancoConta bc ON m.bancoContaId = bc.id
            LEFT JOIN dbo.Fornecedor f ON m.fornecedorId = f.id
            LEFT JOIN dbo.PlanoContas p ON m.planoContaId = p.id
        """,
        "nome_aba": "BASE_FINANCEIRA",
        "coluna_padrao_id": "importacaoLoteId"
    },
    "BaseFolhaPagamento": {
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

PALAVRAS_REMOVIDAS = [
    "recebimento",
    "pagamento",
    "pix",
    "saque",
    "outra if",
    "recebido",
    "emitido",
    "deb",
    "cred",
    "transf",
    "recebida",
    "TRANSFRECEBIDA",
    " de boleto",
    "compra",
    "enviado",
    "compra com cartão",
    "compra com cartao",
    "com cartao"
    "ocorrencia"
]

REGRAS_FORNECEDORES= [
    ("debconvtributos federais - rfb", "RECEITA FEDERAL"),
    ("tarifa", "BANCO"),
    ("pagamento agua", "SABESP"),
    ("luz copel", "COPEL"),
    ("CEF MATRIZ", "CAIXA ECNOMICA FEDERAL"),
    ("SALDO", "SALDO"),
    ("SIMPLES NACIONAL", "RECEITA FEDERAL"),
    ("IOF", "RECEITA FEDERAL"),
    ("DARF", "RECEITA FEDERAL"),
    ("Rende Facil", "(NOME DO BANCO)"),
    ("Tar. agrupadas", "(NOME DO BANCO)"),
    ("Pacote de Serviços", "(NOME DO BANCO)"),
    ("TARIFA MANUTENCAO", "(NOME DO BANCO)"),
    ("Tarifa Pix Recebido", "(NOME DO BANCO)"),
    ("NASH CONSULTORIA", "NASH CONSULTORIA EMPRESARIAL"),
    ("Pagamento de Impostos - DAS", "RECEITA FEDERAL"),
    ("DAS - SIMPLES NACIONAL", "RECEITA FEDERAL"),
    ("RFB", "RECEITA FEDERAL"),
    ("Mensalidade", "(NOME DO BANCO)"),
    ("Tar DOC/TED PESSOAL", "(NOME DO BANCO)"),
    ("Tarifa (Saída)", "(NOME DO BANCO)"),
    ("DÉB.CONV.TRIBUTOS FEDERAIS - RFB", "RECEITA FEDERAL"),
    ("TRIBUTOS FEDERAIS", "RECEITA FEDERAL"),
    ("PRONAMPE", "(NOME DO BANCO)"),
    ("PFL CIA PAULISTA DE FORC", "CPFL PAULISTA"),
    ("SEM PARAR INSTITUICAO", "SEM PARAR INSTITUICAO"),
    ("TELEFONICA BRASIL S.A", "VIVO FIXO/BRASIL"),
    ("ZOOP BRASIL", "IFOOD"),
    ("Maquininha","OUTROS CLIENTES"),
    ("ALELO","ALELO"),
    ("ITAU","ITAU UNIBANCO HOLDING S.A."),
    ("CIELO","BENEFICIO CIELO"),
    ("TARIFA","STONE"),
    ("Bella Gourm","RODRIGUES E SOARES RESTAURANTE LTDA"),
    ("IFOOD","IFOOD CREDITO"),
    ("Pedrobezerra","PEDRO BEZERRA DE SIQUEIRA"),
    ("DIOUERITA","DIOUERITA"),
    ("MASTERCARD","ANTECIPACAO MASTERCARD"),
    ("PLUXEE","BENEFICIO PLUXEE"),
    ("OUTRA IF", {"PAGAMENTO": "OUTROS FORNECEDORES", "RECEBIMENTO": "OUTROS CLIENTES"}),
    ("AMERICAN EXPRE","ANTECIPACAO AMERICAN"),
    ("ant visa","ANTECIPACAO VISA"),
    ("ant_visa","ANTECIPACAO VISA"),
    ("ant._visa","ANTECIPACAO VISA"),
    ("deb visa","DEBITO VISA"),
    ("deb_visa","DEBITO VISA"),
    ("deb._visa","DEBITO VISA"),
    ("REM.:","OUTROS CLIENTES"),
    ("MAESTRO","DEBITO MAESTRO"),
    ("ASSAI ATACADISTA","ASSAI ATACADISTA"),
    ("DÉB.TIT.COMPE EFETIVADO","OUTROS FORNECEDORES"),
    ("DÉB.CONV.ORGÃOS GOV","RECEITA FEDERAL"),
    ("deb._ELO","DEBITO ELO"),
    ("ant._ELO","ANTECIPACAO ELO"),
    ("DÉB.TÍTULO COBRANÇA","SO FILTROS RONDONIA LTDA")    
]