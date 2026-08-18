---------------------------------------------------------------------------------
--						Criando Banco
---------------------------------------------------------------------------------

create database NashBancoConsultoria

use NashBancoConsultoria

---------------------------------------------------------------------------------
--						Criando Tabelas
---------------------------------------------------------------------------------

create table Contratante
(
	id					int					not null		primary key		identity,
	nome				varchar(255)		not null		unique,
	razaoSocial			varchar(255)			null,
	status				int					not null		default 1		-- 1.Ativo, 2.Inativo
)

create table Unidade
(
	id					int					not null		primary key		identity,
	nome				varchar(255)		not null		unique,
	razaoSocial			varchar(255)			null,
	cnpj				varchar(20)				null,
	contratanteId		int,
	tipo				int					not null		default 1,		-- 1.Registro, 2.Atuação, 3.Ambos
	status				int					not null		default 1		-- 1.Ativo, 2.Inativo
	foreign key (contratanteId)				references Contratante(id),
)

create table BancoConta
(
	id					int					not null		primary key		identity,
	banco				varchar(255),
	agencia				varchar(50),
	conta				varchar(50),
	constraint UC_BancoConta				unique (banco, agencia, conta)
)

create table Fornecedor 
(
    id					int					not null		primary key		identity,
    nome				varchar(255)		not null,
    cpf_cnpj			varchar(50)				null,
    CONSTRAINT UC_Fornecedor				unique (cpf_cnpj, nome)			-- Evita cadastrar o mesmo cara duas vezes
);

create table ImportacaoLote
(
	id					int					not null		primary key		identity,
	nomeArquivo			varchar(255)		not null,
	contratanteId		int						null,
	criadoEm			datetime							default			getdate()
)

create table PlanoContas
(
	id					int					not null		primary key		identity,
	planoConta			varchar(100)		not null,						-- Nível 1
	grupoConta			varchar(100)		not null,						-- Nível 2
	edre				varchar(100)		not null,						-- Nível 3
	dfc					varchar(100)		not null,						-- Nivel 3
	efolha				varchar(100)		not null,						-- Nivel 3
	criadoEm			datetime							default			getdate(),
	importacaoLoteId	int,

	foreign key (importacaoLoteId)			references ImportacaoLote(id)
)

CREATE TABLE PlanoDePara 
(
    id					int					not null		primary key		identity,
    contratanteId       int						null,						-- NULL = Regra Global
	unidadeId			int						null,						-- NULL = Regra Global
	bancoId				int						null,						-- NULL = Regra Global
    termoDescricao      varchar(255)			null,						-- Busca na Descrição (Ex: "TARIFA")
    termoFornecedor     varchar(255)			null,						-- Busca no Fornecedor (Ex: "ITAU")
    planoContaId        int						not null,					-- Mapeia para PlanoContas

    -- Chaves Estrangeiras
	CONSTRAINT FK_PlanoDePara_Contratante foreign key (contratanteId) references Contratante(id) on delete cascade,
	CONSTRAINT FK_PlanoDePara_Unidade foreign key (unidadeId) references Unidade(id) on delete cascade,
	CONSTRAINT FK_PlanoDePara_BancoConta foreign key (bancoId) references BancoConta(id) on delete cascade,
    CONSTRAINT FK_PlanoDePara_PlanoContas foreign key (planoContaId) references PlanoContas(id) on delete cascade,

    -- Validação: Pelo menos um dos dois termos DEVE estar preenchido
    CONSTRAINT CK_PlanoDePara_PeloMenosUmTermo CHECK (termoDescricao IS NOT NULL OR termoFornecedor IS NOT NULL)
);

create table Movimentacao
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
	planoContaId		int,
	importacaoLoteId	int,

	foreign key (unidadeId)					references Unidade(id),
	foreign key (bancoContaId)				references BancoConta(id),
	foreign key (fornecedorId)				references Fornecedor(id),
	foreign key (planoContaId)				references PlanoContas(id),
	foreign key (importacaoLoteId)			references ImportacaoLote(id)
)

create table MovimentacaoFolhaPagamento
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
)

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
)

create table UsuarioContratante
(
	id					int					not null		primary key		identity,
	usuarioId			int					not null,
	contratanteId		int					not null,

	foreign key (usuarioId)					references Usuario(id) on delete cascade,
	foreign key (contratanteId)				references Contratante(id) on delete cascade,

	constraint UQ_UsuarioContratante		unique (usuarioId, contratanteId)
)

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

    foreign key (usuarioId)					references Usuario(id) on delete cascade,
    foreign key (permissaoId)				references Permissao(id) on delete cascade,

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

	foreign key (usuarioId)					references Usuario(id) on delete cascade
)

---------------------------------------------------------------------------------
--						Verificando Valores
---------------------------------------------------------------------------------
select * from Contratante
select * from Unidade
select * from BancoConta
select * from Fornecedor
select * from ImportacaoLote
select * from PlanoContas
select * from PlanoDePara
select * from Movimentacao
select * from MovimentacaoFolhaPagamento
select * from Usuario
select * from UsuarioContratante
select * from Permissao
select * from UsuarioPermissao
select * from LogUsuario

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