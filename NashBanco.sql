---------------------------------------------------------------------------------
--						Criando Banco
---------------------------------------------------------------------------------

create database NashBancoConsultoria

use NashBancoConsultoria

---------------------------------------------------------------------------------
--						Criando Tabelas
---------------------------------------------------------------------------------

create table ImportacaoLote
(
	id					int					not null		primary key		identity,
	nomeArquivo			varchar(255)		not null,
	contratanteId		int						null,
	criadoEm			datetime							default			getdate()
);

create table Banco
(
	id					int					not null		primary key		identity,
	codigo				varchar(10)			not null		unique,
	nome				varchar(255)		not null,
	status				int					not null		default 1,		-- 1.Ativo, 2.Inativo
	importacaoLoteId	int,

	foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

create table Contratante
(
	id					int					not null		primary key		identity,
	nome				varchar(255)		not null		unique,
	razaoSocial			varchar(255)			null,
	status				int					not null		default 1,		-- 1.Ativo, 2.Inativo
	importacaoLoteId	int,

	foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

create table Unidade
(
	id					int					not null		primary key		identity,
	nome				varchar(255)		not null		unique,
	razaoSocial			varchar(255)			null,
	cnpj				varchar(20)				null,
	contratanteId		int					not null,
	tipo				int					not null		default 1,		-- 1.Registro, 2.Atuação, 3.Ambos
	status				int					not null		default 1,		-- 1.Ativo, 2.Inativo
	importacaoLoteId	int,

	foreign key (contratanteId)				references Contratante(id),
	foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

create table BancoConta
(
	id					int					not null		primary key		identity,
	bancoId				int					not null,
	agencia				varchar(50),
	conta				varchar(50),
	unidadeId			int,

	foreign key (bancoId)					references Banco(id),
	foreign key (unidadeId)					references Unidade(id),
	constraint UC_BancoConta				unique (bancoId, agencia, conta),
);

create table Fornecedor 
(
    id					int					not null		primary key		identity,
    nome				varchar(255)		not null,
    cpfCnpj				varchar(50)				null,
	status				int					not null		default 1,		-- 1.Ativo, 2.Inativo
	importacaoLoteId	int,

	foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

create table FornecedorRegras 
(
    id					int					not null		primary key		identity,
    termoDescricao      varchar(255)			null,                       -- Busca na Descrição (Ex: "TARIFA")
    termoTipo           varchar(255)			null,                       -- Busca no Tipo (Ex: "RECEBIMENTO")
    fornecedorId		int					not null,                       -- Mapeia para Fornecedor
	prioridade			int						null		default 0,
    importacaoLoteId    int						null,

    -- Chaves Estrangeiras
	constraint FK_FornecedorRegras_Fornecedor foreign key (fornecedorId)     references Fornecedor(id)			on delete cascade,
    constraint FK_FornecedorRegras_Lote       foreign key (importacaoLoteId) references ImportacaoLote(id)		on delete cascade,

    -- Validação: Pelo menos UM dos critérios de busca DEVE estar preenchido
    constraint CK_FornecedorRegras_PeloMenosUmTermo CHECK (
        termoDescricao IS NOT NULL OR 
        termoTipo IS NOT NULL
    )
);

create table PlanoContas
(
	id					int					not null		primary key		identity,
	planoConta			varchar(100)		not null,						-- Nível 1
	grupoConta			varchar(100)		not null,						-- Nível 2
	edre				varchar(100)		not null,						-- Nível 3
	dfc					varchar(100)		not null,						-- Nivel 3
	efolha				varchar(100)		not null,						-- Nivel 3
	criadoEm			datetime							default			getdate(),
	status				int					not null		default 1,		-- 1.Ativo, 2.Inativo
	importacaoLoteId	int,

	foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

CREATE TABLE PlanoDePara 
(
    id					int					not null		primary key		identity,
    contratanteId       int                     null,                       -- NULL = Regra Global
    unidadeId           int                     null,                       -- NULL = Regra Global
    bancoId             int						null,                       -- NULL = Regra Global
    termoDescricao      varchar(255)			null,                       -- Busca na Descrição (Ex: "TARIFA")
    termoTipo           varchar(255)			null,                       -- Busca no Tipo (Ex: "RECEBIMENTO")
    fornecedorId		int						null,                       -- Busca no Fornecedor (Ex: "ITAU")
    planoContaId        int					not null,                       -- Mapeia para PlanoContas
	prioridade			int						null		default 0,
    importacaoLoteId    int,

    -- Chaves Estrangeiras
    constraint FK_PlanoDePara_Contratante       foreign key (contratanteId)		references Contratante(id)		on delete cascade,
    constraint FK_PlanoDePara_Unidade           foreign key (unidadeId)			references Unidade(id)			on delete cascade,
    constraint FK_PlanoDePara			        foreign key (bancoId)			references Banco(id)			on delete cascade,
	constraint FK_PlanoDePara_Fornecedor		foreign key (fornecedorId)		references Fornecedor(id)		on delete cascade,
    constraint FK_PlanoDePara_PlanoContas       foreign key (planoContaId)		references PlanoContas(id)		on delete cascade,
                                                foreign key (importacaoLoteId)	references ImportacaoLote(id)	on delete cascade,

    -- Validação: Pelo menos UM dos três termos DEVE estar preenchido
    constraint CK_PlanoDePara_PeloMenosUmTermo check (
        termoDescricao IS NOT NULL OR 
        termoTipo IS NOT NULL OR 
        fornecedorId IS NOT NULL
    )
);

create table BaseFinanceiro
(
	id					int					not null		primary key		identity,
	unidadeId			int,
	bancoContaId		int,
	fornecedorId		int,
	data				datetime,
	descricao			varchar(max),
	obs					varchar(max),
	valor				decimal(38,2),
	tipo				varchar(50),
	planoContaId		int					not null,
	importacaoLoteId	int,

	foreign key (unidadeId)					references Unidade(id),
	foreign key (bancoContaId)				references BancoConta(id),
	foreign key (fornecedorId)				references Fornecedor(id),
	foreign key (planoContaId)				references PlanoContas(id),
	foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

create table BaseFolhaPagamento
(
    id                      int				not null		primary key		identity,
    unidadeRegistroId       int				not null,
    unidadeAtuacaoId        int				not null,
    nome			        varchar(150),
    cpf						varchar(14),
    dataNascimento          DATE,
    cboCargo                varchar(20),
    cargo                   varchar(100),
    departamento            varchar(100),
    dataAdmissao            date,
	descricao				varchar(max),
	planoContaId			int,
    dataCompetencia         date,
    dataCaixa               date,
	tipo					varchar(50),
    valor                   DECIMAL(38,2),
	importacaoLoteId        int				not null,

	foreign key (unidadeRegistroId)			references Unidade(id),
	foreign key (unidadeAtuacaoId)			references Unidade(id),
    foreign key (planoContaId)				references PlanoContas(id),
    foreign key (importacaoLoteId)			references ImportacaoLote(id)
);

create table Usuario
(
	id					int					not null		primary key		identity,
	nome				varchar(100)		not null,
	email				varchar(150)		not null		unique,
	senha				varchar(255)		not null,
	perfil				int					not null,						-- 1.Admin, 2.Funcionario, 3.Cliente
	contratanteId		int						null,						-- Se o perfil for cliente ele é contratante
	status				int					not null		default 1,		-- 1.Ativo, 2.Inativo
	protegido			int					not null		default 0,

	foreign key (contratanteId)				references Contratante(id)
);

create table UsuarioContratante
(
	id					int					not null		primary key		identity,
	usuarioId			int					not null,
	contratanteId		int					not null,

	foreign key (usuarioId)					references Usuario(id)			on delete cascade,
	foreign key (contratanteId)				references Contratante(id)		on delete cascade,

	constraint UQ_UsuarioContratante		unique (usuarioId, contratanteId)
);

CREATE TABLE Permissao
(
    id					int					not null		primary key		identity,
    chave				varchar(100)		not null		UNIQUE,			-- Ex: 'regras_plano:criar', 'regras_plano:excluir'
    nome				varchar(150)		not null,						-- Ex: 'Criar Regra no Plano de Contas'
    modulo				varchar(50)			not null						-- Ex: 'PlanoContas', 'Usuario', 'Importacao'
);

CREATE TABLE UsuarioPermissao
(
    id					int					not null		primary key		identity,
    usuarioId			int					not null,
    permissaoId			int					not null,

    foreign key (usuarioId)					references Usuario(id)			on delete cascade,
    foreign key (permissaoId)				references Permissao(id)		on delete cascade,

    constraint UQ_UsuarioPermissao			unique (usuarioId, permissaoId)
);

create table LogUsuario
(
	id					int					not null		primary key		identity,
	usuarioId			int					not null,
	acao				varchar(50)			not null,						--Login, Logout, Importacao, etc
	tabela				varchar(50)				null,						--Movimentação, Usuario, Contratante, etc
	ip					varchar(45)				null,
	detalhes			varchar(max)			null,						--JSON completo
	criadoEm			datetime			default			getdate(),

	foreign key (usuarioId)					references Usuario(id)			on delete cascade
);

create table ChangeLog
(
    id					int					not null		primary key		identity,
    versao				varchar(20)				null,
    titulo				varchar(150)		not null,
    descricao			varchar(MAX)		not null,
    criadoEm			datetime			not null		default getdate(),
);

---------------------------------------------------------------------------------
--						Verificando Valores
---------------------------------------------------------------------------------

select * from Contratante;
select * from Unidade;
select * from Banco;
select * from BancoConta;
select * from Fornecedor;
select * from FornecedorRegras;
select * from ImportacaoLote;
select * from PlanoContas;
select * from PlanoDePara;
select * from BaseFinanceiro;
select * from BaseFolhaPagamento;
select * from Usuario;
select * from UsuarioContratante;
select * from Permissao;
select * from UsuarioPermissao;
select * from LogUsuario;
select * from ChangeLog;

---------------------------------------------------------------------------------
--						Backup do Banco (Testes)
---------------------------------------------------------------------------------
--Pasta de Backup Padrão do SQL SERVER
exec master.dbo.xp_instance_regread
	N'HKEY_LOCAL_MACHINE',
	N'Software\Microsoft\MSSQLServer\MSSQLServer',
	N'BackupDirectory';

--Backup
backup database NashBancoConsultoria
to disk = 'C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\Backup\NashBancoConsultoria.bak'
with format, init, name = 'Backup de Banco de Dados';

--Restore
use master;
restore database NashBancoTeste
from disk = 'C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\Backup\NashBancoTeste.bak'
with replace;

alter database NashBancoConsultoria set multi_user;

use NashBancoConsultoria
---------------------------------------------------------------------------------
--						Excluindo Banco (Testes)
---------------------------------------------------------------------------------

use master
alter database NashBancoConsultoria set single_user with rollback immediate
drop database NashBancoConsultoria

---------------------------------------------------------------------------------
--						Insert de changelog
---------------------------------------------------------------------------------

truncate table ChangeLog;

insert into ChangeLog (versao, titulo, descricao, criadoEm) values
(
    'Alpha v0.0.1',
    'Lançamento Inicial',
    '### Novidades' + CHAR(13) + CHAR(10) +
    '- Sistema de exportação da tabela geral importada' + CHAR(13) + CHAR(10) +
    '- Cadastro manual de plano de contas' + CHAR(13) + CHAR(10) +
    '- Cadastro de Fornecedores' + CHAR(13) + CHAR(10) +
    '- Cadastro de regras para a coluna de fornecedores' + CHAR(13) + CHAR(10) +
    '- Criação de página para Fornecedores' + CHAR(13) + CHAR(10) +
    '- Criação de página de ChangeLog' + CHAR(13) + CHAR(10) +
    '- Criação de prioridade de regras' + CHAR(13) + CHAR(10) +
    '---' + CHAR(13) + CHAR(10) +
    '### Correções' + CHAR(13) + CHAR(10) +
    '- Correção de bug ao baixar a lista de regras de fornecedores tanto da página de fornecedores quanto da página de lotes importados' + CHAR(13) + CHAR(10) +
    '- Correção de erros em fornecedores' + CHAR(13) + CHAR(10) +
    '- Correção de caractere desconhecido no cadastro' + CHAR(13) + CHAR(10) +
    '- Correção de tela de Logs' + CHAR(13) + CHAR(10) +
    '- Fornecedores com o tipo "pagamento" corretamente classificados' + CHAR(13) + CHAR(10) +
    '- Finalização DRE com bases testadas' + CHAR(13) + CHAR(10) +
    '- Manutenção da coluna de fornecedores' + CHAR(13) + CHAR(10) +
    '- Tratamento de texto em agencia/conta em ofx e pdf' + CHAR(13) + CHAR(10) +
	'- Manutenção da coluna de fornecedores' + CHAR(13) + CHAR(10) +
	'- Correção no front: Bloqueio do botao de edição de admin supremo + botao de inativação da propria conta',
    '20260901 14:50:00'
)