from fastapi import HTTPException, Request
from datetime import datetime, date
from decimal import Decimal
import pandas as pd
import io

from app.schemas.usuarios_schema import UsuarioToken
from app.config import BANCO_AUTENTICACAO
from app.database import obter_conexao
from app.security import registrar_log
from app.utils import normalizar_texto, limpar_e_normalizar

def processar_importacao_plano_contas(
    conteudo_arquivo: bytes, 
    nome_arquivo: str, 
    usuario_id: int, 
    request: Request
):
    """
    Processa o upload do Excel do Plano de Contas.
    """
    conexao = None
    try:
        buffer = io.BytesIO(conteudo_arquivo)
        
        try:
            df = pd.read_excel(buffer, sheet_name='PLANO_CONTA')
        except Exception:
            buffer.seek(0)
            df = pd.read_excel(buffer)

        # Padroniza nomes das colunas (Remove espaços, hífen e converte para maiúsculo)
        df.columns = [str(col).strip().upper().replace("-", "") for col in df.columns]

        # 1. Validação de Colunas Obrigatórias (Agora com EFOLHA / EFOLHA/E-FOLHA)
        colunas_necessarias = ["PLANO DE CONTAS", "GRUPO DE CONTAS", "EDRE", "DFC", "EFOLHA"]
        for col in colunas_necessarias:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Coluna obrigatória '{col}' não foi encontrada na planilha de Plano de Contas."
                )

        # Trata os valores da tabela
        for col in df.columns:
            df[col] = df[col].astype(str).str.strip()

        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # 2. Gestão do Lote de Importação
        cursor.execute("""
            SELECT id FROM dbo.ImportacaoLote 
            WHERE nomeArquivo = ? AND contratanteId IS NULL
        """, (nome_arquivo,))
        lote_existente = cursor.fetchone()

        if lote_existente:
            lote_id = lote_existente[0]
            cursor.execute("UPDATE dbo.ImportacaoLote SET criadoEm = GETDATE() WHERE id = ?", (lote_id,))
        else:
            # Usa OUTPUT INSERTED.id para capturar o ID gerado de forma garantida no T-SQL
            cursor.execute("""
                INSERT INTO dbo.ImportacaoLote (nomeArquivo, contratanteId, criadoEm) 
                OUTPUT INSERTED.id
                VALUES (?, NULL, GETDATE())
            """, (nome_arquivo,))
            
            row_lote = cursor.fetchone()
            if not row_lote or row_lote[0] is None:
                raise HTTPException(status_code=500, detail="Não foi possível gerar o ID do Lote de Importação.")
            
            lote_id = int(row_lote[0])

        # 3. Desativa temporariamente a verificação de FKs nas tabelas dependentes
        cursor.execute("ALTER TABLE dbo.Movimentacao NOCHECK CONSTRAINT ALL")
        cursor.execute("ALTER TABLE dbo.MovimentacaoFolhaPagamento NOCHECK CONSTRAINT ALL")

        # 4. Limpa a estrutura anterior e reseta ID
        cursor.execute("DELETE FROM dbo.PlanoContas")
        cursor.execute("DBCC CHECKIDENT ('dbo.PlanoContas', RESEED, 0)")

        # 5. Insere a nova estrutura
        query_insert = """
            INSERT INTO dbo.PlanoContas (planoConta, grupoConta, edre, dfc, efolha, criadoEm)
            VALUES (?, ?, ?, ?, ?, GETDATE())
        """
        
        total_linhas = 0
        for _, row in df.iterrows():

            plano = limpar_e_normalizar(row["PLANO DE CONTAS"])
            grupo = limpar_e_normalizar(row["GRUPO DE CONTAS"])
            edre = limpar_e_normalizar(row["EDRE"])
            dfc = limpar_e_normalizar(row["DFC"])
            efolha = limpar_e_normalizar(row["EFOLHA"])
            
            cursor.execute(query_insert, (plano, grupo, edre, dfc, efolha))
            total_linhas += 1

        # 6. Reativa as constraints
        cursor.execute("ALTER TABLE dbo.Movimentacao CHECK CONSTRAINT ALL")
        cursor.execute("ALTER TABLE dbo.MovimentacaoFolhaPagamento CHECK CONSTRAINT ALL")

        # 7. Log de Auditoria
        registrar_log(
            usuario_id=usuario_id,
            acao="IMPORTAR_PLANO_CONTAS",
            tabela="planocontas",
            detalhes={"lote_id": lote_id, "arquivo": nome_arquivo, "total_registros": total_linhas},
            request=request
        )

        conexao.commit()

        return {
            "sucesso": True,
            "tipo": "plano_contas",
            "lote_id": lote_id,
            "mensagem": f"Plano de Contas importado com sucesso no Lote #{lote_id}! ({total_linhas} registros)",
            "total_registros": total_linhas
        }

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        print(f"[ERRO AO IMPORTAR PLANO]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo do Plano de Contas: {str(e)}")
    finally:
        if conexao:
            conexao.close()

def processar_importacao_banco(
    conteudo_arquivo: bytes, 
    nome_arquivo: str, 
    usuario_id: int, 
    request: Request
):
    """
    Processa o upload do Excel com os Bancos vinculando ao ImportacaoLote.
    Aba esperada: 'MAPA_BANCOS'
    Colunas esperadas: CODIGO, BANCO
    """
    conexao = None
    try:
        buffer = io.BytesIO(conteudo_arquivo)
                
        try:
            df = pd.read_excel(buffer, sheet_name='MAPA_BANCOS', dtype=str)
        except Exception:
            buffer.seek(0)
            df = pd.read_excel(buffer)

        # Padroniza nomes das colunas (Remove espaços, hífen e converte para maiúsculo)
        df.columns = [str(col).strip().upper().replace("-", "") for col in df.columns]

        # 1. Validação de Colunas Obrigatórias
        colunas_necessarias = ["CODIGO", "BANCO"]
        for col in colunas_necessarias:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Coluna obrigatória '{col}' não foi encontrada na planilha."
                )

        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # 2. Gestão do Lote de Importação
        cursor.execute("""
            SELECT id FROM dbo.ImportacaoLote 
            WHERE nomeArquivo = ?
        """, (nome_arquivo,))
        lote_existente = cursor.fetchone()

        if lote_existente:
            lote_id = lote_existente[0]
            cursor.execute("UPDATE dbo.ImportacaoLote SET criadoEm = GETDATE() WHERE id = ?", (lote_id,))
        else:
            cursor.execute("""
                INSERT INTO dbo.ImportacaoLote (nomeArquivo, contratanteId, criadoEm) 
                OUTPUT INSERTED.id
                VALUES (?, NULL, GETDATE())
            """, (nome_arquivo,))
            
            row_lote = cursor.fetchone()
            if not row_lote or row_lote[0] is None:
                raise HTTPException(status_code=500, detail="Não foi possível gerar o ID do Lote de Importação.")
            
            lote_id = int(row_lote[0])

        # 3. Limpa os registros anteriores de bancos atrelados a este lote
        cursor.execute("DELETE FROM dbo.Banco WHERE importacaoLoteId = ?", (lote_id,))

        total_linhas = 0
        erros_validacao = []

        # Query utilizando MERGE (Upsert) para inserir ou atualizar o nome/status caso o código do banco já exista
        query_upsert = """
            MERGE dbo.Banco AS target
            USING (SELECT ? AS codigo, ? AS nome, ? AS importacaoLoteId) AS source
            ON (target.codigo = source.codigo)
            WHEN MATCHED THEN
                UPDATE SET target.nome = source.nome, 
                           target.status = 1, 
                           target.importacaoLoteId = source.importacaoLoteId
            WHEN NOT MATCHED THEN
                INSERT (codigo, nome, status, importacaoLoteId)
                VALUES (source.codigo, source.nome, 1, source.importacaoLoteId);
        """

        # 4. Processamento das Linhas do DataFrame
        for idx, row in df.iterrows():
            linha_num = idx + 2  # Considera o cabeçalho como linha 1

            val_codigo = limpar_e_normalizar(row["CODIGO"])
            val_banco = limpar_e_normalizar(row["BANCO"])

            # Validações dos campos obrigatórios por linha
            if not val_codigo:
                erros_validacao.append(f"Linha {linha_num}: 'CODIGO' é obrigatório.")
                continue
            if not val_banco:
                erros_validacao.append(f"Linha {linha_num}: 'BANCO' é obrigatório.")
                continue

            # Executa a inserção / atualização
            cursor.execute(query_upsert, (val_codigo, val_banco, lote_id))
            total_linhas += 1

        # Interrompe o processo e desfaz as alterações caso existam erros de validação
        if erros_validacao:
            conexao.rollback()
            raise HTTPException(
                status_code=400,
                detail={"mensagem": "Erros de validação encontrados no arquivo.", "erros": erros_validacao}
            )

        # 5. Log de Auditoria
        registrar_log(
            usuario_id=usuario_id,
            acao="IMPORTAR_MAPA_BANCOS",
            tabela="Banco",
            detalhes={"lote_id": lote_id, "arquivo": nome_arquivo, "total_registros": total_linhas},
            request=request
        )

        conexao.commit()

        return {
            "sucesso": True,
            "tipo": "mapa_bancos",
            "lote_id": lote_id,
            "mensagem": f"Mapa de Bancos importado com sucesso no Lote #{lote_id}! ({total_linhas} registros)",
            "total_registros": total_linhas
        }

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        print(f"[ERRO AO IMPORTAR MAPA BANCOS]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo do Mapa de Bancos: {str(e)}")
    finally:
        if conexao:
            conexao.close()

def processar_importacao_unidade(
    conteudo_arquivo: bytes, 
    nome_arquivo: str, 
    usuario_id: int, 
    request: Request
):
    """
    Processa o upload do Excel com as Unidades vinculando ao ImportacaoLote.
    Aba esperada: 'MAPA_UNIDADES'
    Colunas esperadas: CONTRATANTE, NOME, RAZAO SOCIAL, CNPJ, TIPO
    """
    conexao = None
    try:
        buffer = io.BytesIO(conteudo_arquivo)
                
        try:
            df = pd.read_excel(buffer, sheet_name='MAPA_UNIDADES', dtype=str)
        except Exception:
            buffer.seek(0)
            df = pd.read_excel(buffer, dtype=str)

        # Padroniza nomes das colunas (Remove espaços, hífen e converte para maiúsculo)
        df.columns = [str(col).strip().upper().replace("-", "") for col in df.columns]

        # 1. Validação de Colunas Obrigatórias
        colunas_necessarias = ["CONTRATANTE", "NOME", "RAZAO SOCIAL", "CNPJ", "TIPO"]
        for col in colunas_necessarias:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Coluna obrigatória '{col}' não foi encontrada na planilha."
                )

        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # 2. Mapeamento de Contratantes (Busca todos do BD para validação rápida)
        cursor.execute("SELECT id, UPPER(nome), UPPER(razaoSocial) FROM dbo.Contratante")
        mapa_contratantes = {}
        for row in cursor.fetchall():
            c_id, c_nome, c_razao = row[0], row[1], row[2]
            if c_nome:
                mapa_contratantes[c_nome.strip()] = c_id
            if c_razao:
                mapa_contratantes[c_razao.strip()] = c_id

        # 3. Gestão do Lote de Importação
        cursor.execute("""
            SELECT id FROM dbo.ImportacaoLote 
            WHERE nomeArquivo = ?
        """, (nome_arquivo,))
        lote_existente = cursor.fetchone()

        if lote_existente:
            lote_id = lote_existente[0]
            cursor.execute("UPDATE dbo.ImportacaoLote SET criadoEm = GETDATE() WHERE id = ?", (lote_id,))
        else:
            cursor.execute("""
                INSERT INTO dbo.ImportacaoLote (nomeArquivo, contratanteId, criadoEm) 
                OUTPUT INSERTED.id
                VALUES (?, NULL, GETDATE())
            """, (nome_arquivo,))
            
            row_lote = cursor.fetchone()
            if not row_lote or row_lote[0] is None:
                raise HTTPException(status_code=500, detail="Não foi possível gerar o ID do Lote de Importação.")
            
            lote_id = int(row_lote[0])

        # 4. Limpa as unidades anteriores atreladas a este lote
        cursor.execute("DELETE FROM dbo.Unidade WHERE importacaoLoteId = ?", (lote_id,))

        def limpar_campo(val):
            if pd.isna(val):
                return None
            val_str = str(val).strip()
            if val_str.endswith(".0"):
                val_str = val_str[:-2]
            if val_str.lower() in ["nan", "none", "", "null"]:
                return None
            return val_str

        def mapear_tipo(tipo_str):
            if not tipo_str:
                return 1  # Valor default (1 - Registro)
            t = tipo_str.strip().lower()
            if t in ["1", "registro"]:
                return 1
            elif t in ["2", "atuacao", "atuação"]:
                return 2
            elif t in ["3", "ambos"]:
                return 3
            return 1

        total_linhas = 0
        erros_validacao = []

        # Query MERGE baseada no campo NOME (único)
        query_upsert = """
            MERGE dbo.Unidade AS target
            USING (SELECT ? AS nome, ? AS razaoSocial, ? AS cnpj, ? AS contratanteId, ? AS tipo, ? AS importacaoLoteId) AS source
            ON (UPPER(target.nome) = UPPER(source.nome))
            WHEN MATCHED THEN
                UPDATE SET target.razaoSocial = source.razaoSocial, 
                           target.cnpj = source.cnpj, 
                           target.contratanteId = source.contratanteId, 
                           target.tipo = source.tipo, 
                           target.status = 1, 
                           target.importacaoLoteId = source.importacaoLoteId
            WHEN NOT MATCHED THEN
                INSERT (nome, razaoSocial, cnpj, contratanteId, tipo, status, importacaoLoteId)
                VALUES (source.nome, source.razaoSocial, source.cnpj, source.contratanteId, source.tipo, 1, source.importacaoLoteId);
        """

        # 5. Processamento das Linhas do DataFrame
        for idx, row in df.iterrows():
            linha_num = idx + 2  # Cabeçalho na linha 1

            val_contratante = limpar_campo(row["CONTRATANTE"])
            val_nome = limpar_campo(row["NOME"])
            val_razao = limpar_campo(row["RAZAO SOCIAL"])
            val_cnpj = limpar_campo(row["CNPJ"])
            val_tipo_raw = limpar_campo(row["TIPO"])

            # Validações dos campos obrigatórios
            if not val_nome:
                erros_validacao.append(f"Linha {linha_num}: 'NOME' da unidade é obrigatório.")
                continue

            if not val_contratante:
                erros_validacao.append(f"Linha {linha_num}: 'CONTRATANTE' é obrigatório.")
                continue

            # Valida existência do Contratante no mapa
            contratante_id = mapa_contratantes.get(val_contratante.upper())
            if not contratante_id:
                erros_validacao.append(f"Linha {linha_num}: Contratante '{val_contratante}' não foi encontrado no sistema.")
                continue

            val_tipo = mapear_tipo(val_tipo_raw)

            # Executa Inserção ou Atualização
            cursor.execute(query_upsert, (val_nome, val_razao, val_cnpj, contratante_id, val_tipo, lote_id))
            total_linhas += 1

        # Interrompe o processo e desfaz as alterações caso existam erros de validação
        if erros_validacao:
            conexao.rollback()
            # Unifica os erros em uma mensagem legível com quebras de linha
            mensagem_erro = "Erros de validação encontrados:\n" + "\n".join(erros_validacao)
            raise HTTPException(
                status_code=400,
                detail=mensagem_erro
            )

        # 6. Log de Auditoria
        registrar_log(
            usuario_id=usuario_id,
            acao="IMPORTAR_MAPA_UNIDADES",
            tabela="Unidade",
            detalhes={"lote_id": lote_id, "arquivo": nome_arquivo, "total_registros": total_linhas},
            request=request
        )

        conexao.commit()

        return {
            "sucesso": True,
            "tipo": "mapa_unidades",
            "lote_id": lote_id,
            "mensagem": f"Mapa de Unidades importado com sucesso no Lote #{lote_id}! ({total_linhas} registros)",
            "total_registros": total_linhas
        }

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        print(f"[ERRO AO IMPORTAR MAPA UNIDADES]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo do Mapa de Unidades: {str(e)}")
    finally:
        if conexao:
            conexao.close()


def processar_importacao_regra_plano(
    conteudo_arquivo: bytes, 
    nome_arquivo: str, 
    usuario_id: int, 
    request: Request
):
    """
    Processa o upload do Excel com as Regras do Plano de Contas (PlanoDePara) vinculando ao ImportacaoLote.
    Aba esperada: 'Regras_Plano'
    Colunas esperadas: CONTRATANTE, UNIDADE, BANCO, DESCRICAO, TIPO, FORNECEDOR, PLANO DE CONTA
    """
    conexao = None
    try:
        buffer = io.BytesIO(conteudo_arquivo)
        
        try:
            df = pd.read_excel(buffer, sheet_name='Regras_Plano')
        except Exception:
            buffer.seek(0)
            df = pd.read_excel(buffer)

        # Padroniza nomes das colunas (Remove espaços, hífen e converte para maiúsculo)
        df.columns = [str(col).strip().upper().replace("-", "") for col in df.columns]

        # 1. Validação de Colunas Obrigatórias
        colunas_necessarias = ["CONTRATANTE", "UNIDADE", "BANCO", "DESCRICAO", "TIPO", "FORNECEDOR", "PLANO DE CONTA"]
        for col in colunas_necessarias:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Coluna obrigatória '{col}' não foi encontrada na planilha de Regras."
                )

        conexao = obter_conexao(BANCO_AUTENTICACAO)
        cursor = conexao.cursor()

        # 2. Carregar Mapeamentos em Memória para Resolução Rápida de IDs
        cursor.execute("SELECT id, LOWER(nome) FROM dbo.Contratante WHERE nome IS NOT NULL")
        map_contratantes = {row[1].strip(): row[0] for row in cursor.fetchall()}

        cursor.execute("SELECT id, LOWER(nome) FROM dbo.Unidade WHERE nome IS NOT NULL")
        map_unidades = {row[1].strip(): row[0] for row in cursor.fetchall()}

        cursor.execute("SELECT id, LOWER(nome) FROM dbo.Banco WHERE nome IS NOT NULL")
        map_bancos = {row[1].strip(): row[0] for row in cursor.fetchall()}

        # Normaliza a chave da tabela do banco exatamente como é feito na planilha
        cursor.execute("SELECT id, planoConta FROM dbo.PlanoContas WHERE planoConta IS NOT NULL")
        map_planos = {normalizar_texto(row[1]): row[0] for row in cursor.fetchall()}

        # 3. Gestão do Lote de Importação
        cursor.execute("""
            SELECT id FROM dbo.ImportacaoLote 
            WHERE nomeArquivo = ? AND contratanteId IS NULL
        """, (nome_arquivo,))
        lote_existente = cursor.fetchone()

        if lote_existente:
            lote_id = lote_existente[0]
            cursor.execute("UPDATE dbo.ImportacaoLote SET criadoEm = GETDATE() WHERE id = ?", (lote_id,))
        else:
            cursor.execute("""
                INSERT INTO dbo.ImportacaoLote (nomeArquivo, contratanteId, criadoEm) 
                OUTPUT INSERTED.id
                VALUES (?, NULL, GETDATE())
            """, (nome_arquivo,))
            
            row_lote = cursor.fetchone()
            if not row_lote or row_lote[0] is None:
                raise HTTPException(status_code=500, detail="Não foi possível gerar o ID do Lote de Importação.")
            
            lote_id = int(row_lote[0])

        # 4. Limpa as regras anteriores deste mesmo lote
        cursor.execute("DELETE FROM dbo.PlanoDePara WHERE importacaoLoteId = ?", (lote_id,))

        # 5. Processamento e Inserção
        query_insert = """
            INSERT INTO dbo.PlanoDePara 
            (contratanteId, unidadeId, bancoId, termoDescricao, termoTipo, termoFornecedor, planoContaId, importacaoLoteId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """

        total_linhas = 0
        erros_validacao = []

        for idx, row in df.iterrows():
            linha_num = idx + 2  # Considera o cabeçalho como linha 1

            val_contratante = limpar_e_normalizar(row["CONTRATANTE"])
            val_unidade = limpar_e_normalizar(row["UNIDADE"])
            val_banco = limpar_e_normalizar(row["BANCO"])
            termo_descricao = limpar_e_normalizar(row["DESCRICAO"])
            termo_tipo = limpar_e_normalizar(row["TIPO"])
            termo_fornecedor = limpar_e_normalizar(row["FORNECEDOR"])
            val_plano = limpar_e_normalizar(row["PLANO DE CONTA"])

            # Validação: É necessário ao menos Descrição, Tipo ou Fornecedor
            if not termo_descricao and not termo_tipo and not termo_fornecedor:
                erros_validacao.append(
                    f"Linha {linha_num}: Preencha ao menos 'DESCRICAO', 'TIPO' ou 'FORNECEDOR'."
                )
                continue

            # Validação: Plano de Contas obrigatório
            if not val_plano:
                erros_validacao.append(f"Linha {linha_num}: 'PLANO DE CONTA' é obrigatório.")
                continue

            plano_id = map_planos.get(val_plano)
            if plano_id is None:
                erros_validacao.append(f"Linha {linha_num}: Plano de Contas '{val_plano}' não está cadastrado no sistema.")
                continue

            # Validação e Resolução de IDs opcionais (Reseta para None a cada linha)
            contratante_id = None
            if val_contratante:
                contratante_id = map_contratantes.get(val_contratante.lower())
                if contratante_id is None:
                    erros_validacao.append(f"Linha {linha_num}: Contratante '{val_contratante}' não encontrado.")
                    continue

            # Validação da existencia da Unidade
            unidade_id = None
            if val_unidade:
                unidade_id = map_unidades.get(val_unidade.lower())
                if unidade_id is None:
                    erros_validacao.append(f"Linha {linha_num}: Unidade '{val_unidade}' não encontrada.")
                    continue

            # Validação da existencia do Banco
            banco_id = None
            if val_banco:
                banco_id = map_bancos.get(val_banco.lower())
                if banco_id is None:
                    erros_validacao.append(f"Linha {linha_num}: Banco '{val_banco}' não está cadastrado no sistema.")
                    continue

            cursor.execute(query_insert, (
                contratante_id,
                unidade_id,
                banco_id,
                termo_descricao,
                termo_tipo,
                termo_fornecedor,
                plano_id,
                lote_id
            ))
            total_linhas += 1

        # Cancela tudo se houver erros de consistência nos dados
        if erros_validacao:
            primeiros_erros = "<br>".join(erros_validacao[:5])
            raise HTTPException(
                status_code=400, 
                detail=f"Erros na validação da planilha:<br>{primeiros_erros}"
            )

        # 6. Log de Auditoria
        registrar_log(
            usuario_id=usuario_id,
            acao="IMPORTAR_REGRAS_PLANO",
            tabela="planodepara",
            detalhes={"lote_id": lote_id, "arquivo": nome_arquivo, "total_registros": total_linhas},
            request=request
        )

        conexao.commit()

        return {
            "sucesso": True,
            "tipo": "regras_plano",
            "lote_id": lote_id,
            "mensagem": f"Regras do Plano de Contas importadas com sucesso no Lote #{lote_id}! ({total_linhas} registros)",
            "total_registros": total_linhas
        }

    except HTTPException as http_err:
        if conexao:
            conexao.rollback()
        raise http_err
    except Exception as e:
        if conexao:
            conexao.rollback()
        print(f"[ERRO AO IMPORTAR REGRAS PLANO]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo de Regras do Plano: {str(e)}")
    finally:
        if conexao:
            conexao.close()

async def processar_importacao_movimentacoes(
    conteudo: bytes, 
    nome_arquivo: str, 
    banco: str, 
    usuario: UsuarioToken, 
    request: Request
):
    conexao = None
    try:
        df = pd.read_excel(io.BytesIO(conteudo), sheet_name="BASE_FINANCEIRA")
        df.columns = [c.strip() for c in df.columns]

        mapeamento_colunas = {
            "contratante": "CONTRATANTE",
            "unidade": "UNIDADE",
            "banco": "BANCO",
            "agencia": "AGENCIA",
            "conta": "CONTA",
            "data": "DATA",
            "descricao": "DESCRICAO",
            "obs": "OBSERVACAO",
            "valor": "VALOR",
            "tipo": "TIPO",
            "fornecedor": "FORNECEDORES",
            "cpf": "CPF_CNPJ",
            "planoConta": "PLANO DE CONTA",
            "grupoConta": "GRUPO DE CONTA"
        }

        # 1. Validação da coluna Contratante
        if mapeamento_colunas["contratante"] not in df.columns:
            return {
                "sucesso": False,
                "mensagem": f"Erro: A coluna '{mapeamento_colunas['contratante']}' não foi encontrada no Excel."
            }

        primeira_linha = df.iloc[0] if not df.empty else None
        nome_contratante_excel = str(primeira_linha[mapeamento_colunas["contratante"]]).strip() if primeira_linha is not None else ""

        if not nome_contratante_excel or nome_contratante_excel.upper() in ["NAN", "NONE"]:
            return {
                "sucesso": False,
                "mensagem": "Erro: O nome do contratante na primeira linha do Excel está vazio ou inválido."
            }

        # Conecta ao banco de dados
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        # 2. Validação e Status do Contratante
        nome_contratante_norm = normalizar_texto(nome_contratante_excel)
        cursor.execute("""
            SELECT id, nome, status FROM dbo.Contratante 
            WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?))
        """, (nome_contratante_norm,))
        
        contratante_validado = cursor.fetchone()
        if not contratante_validado:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Importação Bloqueada! O contratante '{nome_contratante_excel}' não está cadastrado no sistema."
            }
        
        contratante_id = contratante_validado[0]
        nome_contratante_bd = contratante_validado[1]
        raw_status = contratante_validado[2]
        status_contratante = int(raw_status) if raw_status is not None else 1

        if status_contratante != 1:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Importação Bloqueada! O contratante '{nome_contratante_bd}' está INATIVO no sistema."
            }

        # 3. Lógica de Lote (Substituição ou Novo Lote)
        cursor.execute("""
            SELECT id FROM dbo.ImportacaoLote 
            WHERE nomeArquivo = ? AND contratanteId = ?
        """, (nome_arquivo, contratante_id))
        lote_existente = cursor.fetchone()

        if lote_existente:
            lote_id = lote_existente[0]
            cursor.execute("DELETE FROM dbo.Movimentacao WHERE importacaoLoteId = ?", (lote_id,))
        else:
            cursor.execute("""
                INSERT INTO dbo.ImportacaoLote (nomeArquivo, contratanteId) 
                VALUES (?, ?)
            """, (nome_arquivo, contratante_id))
            cursor.execute("SELECT @@IDENTITY")
            lote_id = int(cursor.fetchone()[0])

        # 4. Validação de Colunas Obrigatórias e Células Vazias
        chaves_obrigatorias = ["contratante", "planoConta"]
        colunas_faltantes = [
            mapeamento_colunas[ch] for ch in chaves_obrigatorias
            if mapeamento_colunas[ch] not in df.columns
        ]

        if colunas_faltantes:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Erro: O Excel não possui as colunas obrigatórias: {', '.join(colunas_faltantes)}."
            }

        erros_celulas_vazias = []
        for index, row in df.iterrows():
            linha_excel = index + 2
            for chave in chaves_obrigatorias:
                col_nome = mapeamento_colunas[chave]
                valor = row.get(col_nome)
                if pd.isna(valor) or str(valor).strip() == "" or str(valor).strip().upper() in ["NAN", "NONE"]:
                    erros_celulas_vazias.append(f"Linha {linha_excel}: A coluna '{col_nome}' não pode ficar em branco.")
            if len(erros_celulas_vazias) >= 5:
                break

        if erros_celulas_vazias:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": "Importação Bloqueada! Existem campos obrigatórios em branco:\n" + "\n".join(erros_celulas_vazias)
            }

        # 5. Validação de Datas
        col_data_excel = mapeamento_colunas["data"]
        erros_data = []
        for index, row in df.iterrows():
            valor_data = row[col_data_excel]
            linha_excel = index + 2
            if pd.isna(valor_data):
                erros_data.append(f"Linha {linha_excel}: Data está em branco.")
                continue
            try:
                if not isinstance(valor_data, pd.Timestamp):
                    pd.to_datetime(str(valor_data).strip(), dayfirst=True, errors='raise')
            except Exception:
                erros_data.append(f"Linha {linha_excel}: O valor '{valor_data}' não é uma data válida.")
            if len(erros_data) >= 5:
                break

        if erros_data:
            conexao.close()
            return {"sucesso": False, "mensagem": "Erro de validação nas datas:\n" + "\n".join(erros_data)}

        # 6. Validação do Plano de Contas Específico para DRE
        cursor.execute("SELECT UPPER(TRIM(planoConta)) FROM dbo.PlanoContas")
        planos_no_banco = {normalizar_texto(row[0]) for row in cursor.fetchall()}

        erros_encontrados = []
        for index, row_data in df.iterrows():
            conta_excel = normalizar_texto(str(row_data.get(mapeamento_colunas["planoConta"], "")))
            if conta_excel and conta_excel not in ["NAN", "NONE"]:
                if conta_excel not in planos_no_banco:
                    erros_encontrados.append(f"Linha {index + 2}: O plano de contas '{row_data.get(mapeamento_colunas['planoConta'])}' não está cadastrado no sistema.")
            if len(erros_encontrados) >= 5:
                break

        if erros_encontrados:
            conexao.close()
            return {"sucesso": False, "mensagem": f"Importação bloqueada! Erros no Plano de Contas:\n" + "\n".join(erros_encontrados)}

        # Conversão de Valores
        def obtener_valor(row_data, coluna_excel, tipo_dado="string"):
            col_real = mapeamento_colunas.get(coluna_excel)
            if col_real and col_real in df.columns and pd.notna(row_data[col_real]):
                if coluna_excel == "data":
                    valor = row_data[col_real]
                    if isinstance(valor, (pd.Timestamp, datetime, date)):
                        str_data = valor.strftime('%d/%m/%Y')
                    else:
                        str_data = str(valor).strip()
                    dt = pd.to_datetime(str_data, format="%d/%m/%Y", errors='coerce')
                    if pd.isna(dt):
                        dt = pd.to_datetime(row_data[col_real], dayfirst=True)
                    return dt.to_pydatetime()
                if tipo_dado == "float":
                    try:
                        return Decimal("{:.2f}".format(float(row_data[col_real])))
                    except:
                        return Decimal("0.00")
                
                valor_str = str(row_data[col_real]).strip()
                return valor_str if valor_str.upper() not in ["NAN", "NONE"] else None
                
            return pd.Timestamp("2026-01-01").to_pydatetime() if coluna_excel == "data" else (Decimal("0.00") if tipo_dado == "float" else None)

        # 7. Laço de Inserção nas Tabelas Relacionadas
        linhas_importadas = 0
        for _, row in df.iterrows():
            nome_unidade = obtener_valor(row, "unidade")
            banco_nome = obtener_valor(row, "banco")
            agencia = obtener_valor(row, "agencia")
            conta_num = obtener_valor(row, "conta")
            fornecedor_nome = obtener_valor(row, "fornecedor")
            cpf_cnpj = obtener_valor(row, "cpf")
            p_conta = obtener_valor(row, "planoConta")
            g_conta = obtener_valor(row, "grupoConta")

            # Unidade
            if nome_unidade:
                cursor.execute("SELECT id FROM dbo.Unidade WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?)) AND contratanteId = ?", (nome_unidade, contratante_id))
                u_row = cursor.fetchone()
                unidade_id = u_row[0] if u_row else None
                if not unidade_id:
                    cursor.execute("INSERT INTO dbo.Unidade (nome, contratanteId) VALUES (?, ?)", (nome_unidade, contratante_id))
                    cursor.execute("SELECT @@IDENTITY")
                    unidade_id = int(cursor.fetchone()[0])
            else:
                unidade_id = None

            # BancoConta
            if banco_nome:
                agencia_val = agencia if agencia else None
                conta_val = conta_num if conta_num else None
                cursor.execute("""
                    SELECT id FROM dbo.BancoConta 
                    WHERE UPPER(TRIM(banco)) = UPPER(TRIM(?)) 
                    AND (UPPER(TRIM(agencia)) = UPPER(TRIM(?)) OR (agencia IS NULL AND ? IS NULL))
                    AND (UPPER(TRIM(conta)) = UPPER(TRIM(?)) OR (conta IS NULL AND ? IS NULL))
                """, (banco_nome, agencia_val, agencia_val, conta_val, conta_val))
                b_row = cursor.fetchone()
                banco_conta_id = b_row[0] if b_row else None

                if not banco_conta_id:
                    cursor.execute("INSERT INTO dbo.BancoConta (banco, agencia, conta) VALUES (?, ?, ?)", (banco_nome, agencia_val, conta_val))
                    cursor.execute("SELECT @@IDENTITY")
                    banco_conta_id = int(cursor.fetchone()[0])
            else:
                banco_conta_id = None

            # Fornecedor
            if fornecedor_nome:
                cursor.execute("SELECT id FROM dbo.Fornecedor WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?)) AND (cpf_cnpj = ? OR (cpf_cnpj IS NULL AND ? IS NULL))", (fornecedor_nome, cpf_cnpj, cpf_cnpj))
                f_row = cursor.fetchone()
                fornecedor_id = f_row[0] if f_row else None
                if not fornecedor_id:
                    cursor.execute("INSERT INTO dbo.Fornecedor (nome, cpf_cnpj) VALUES (?, ?)", (fornecedor_nome, cpf_cnpj))
                    cursor.execute("SELECT @@IDENTITY")
                    fornecedor_id = int(cursor.fetchone()[0])
            else:
                fornecedor_id = None

            # PlanoContas: Busca garantindo que o vínculo seja da modalidade DRE
            p_conta_raw = str(row[mapeamento_colunas["planoConta"]]).strip() if pd.notna(row.get(mapeamento_colunas["planoConta"])) else None
            p_conta_norm = normalizar_texto(p_conta_raw) if p_conta_raw else None
            
            has_grupo = "grupoConta" in mapeamento_colunas and mapeamento_colunas["grupoConta"] in df.columns
            g_conta_raw = str(row[mapeamento_colunas["grupoConta"]]).strip() if has_grupo and pd.notna(row.get(mapeamento_colunas["grupoConta"])) else None
            g_conta_norm = normalizar_texto(g_conta_raw) if g_conta_raw else None

            plano_conta_id = None

            if p_conta_raw and p_conta_raw.upper() not in ["NAN", "NONE"]:
                # 1ª Tentativa: Busca exata combinando Plano + Grupo
                if g_conta_raw and g_conta_raw.upper() not in ["NAN", "NONE"]:
                    cursor.execute("""
                        SELECT id FROM dbo.PlanoContas 
                        WHERE UPPER(TRIM(REPLACE(planoConta, CHAR(160), ' '))) = UPPER(TRIM(REPLACE(?, CHAR(160), ' ')))
                          AND UPPER(TRIM(REPLACE(grupoConta, CHAR(160), ' '))) = UPPER(TRIM(REPLACE(?, CHAR(160), ' ')))
                    """, (p_conta_raw, g_conta_raw))
                    plano_row = cursor.fetchone()
                    if plano_row:
                        plano_conta_id = plano_row[0]

                # 2ª Tentativa: Busca exata apenas pelo Plano (priorizando DRE)
                if not plano_conta_id:
                    cursor.execute("""
                        SELECT id FROM dbo.PlanoContas 
                        WHERE UPPER(TRIM(REPLACE(planoConta, CHAR(160), ' '))) = UPPER(TRIM(REPLACE(?, CHAR(160), ' ')))
                        ORDER BY CASE WHEN UPPER(TRIM(edre)) <> 'NAO APLICA' THEN 1 ELSE 2 END
                    """, (p_conta_raw,))
                    plano_row = cursor.fetchone()
                    if plano_row:
                        plano_conta_id = plano_row[0]

                # 3ª Tentativa (Fallback de Acentuação): Se ainda não encontrou, compara insensível a acentos (usando Collation do SQL)
                if not plano_conta_id:
                    cursor.execute("""
                        SELECT id FROM dbo.PlanoContas 
                        WHERE planoConta COLLATE Latin1_General_CI_AI = ?
                        ORDER BY CASE WHEN UPPER(TRIM(edre)) <> 'NAO APLICA' THEN 1 ELSE 2 END
                    """, (p_conta_norm,))
                    plano_row = cursor.fetchone()
                    if plano_row:
                        plano_conta_id = plano_row[0]

            # Movimentacao
            cursor.execute("""
                INSERT INTO dbo.Movimentacao (
                    unidadeId, bancoContaId, fornecedorId, planoContaId, data, descricao, obs, valor, tipo, importacaoLoteId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                unidade_id, banco_conta_id, fornecedor_id, plano_conta_id, 
                obtener_valor(row, "data"), obtener_valor(row, "descricao"), 
                obtener_valor(row, "obs"), obtener_valor(row, "valor", "float"), 
                obtener_valor(row, "tipo"), lote_id
            ))
            linhas_importadas += 1

        # Registro do Log com 'request=request' para capturar IP
        registrar_log(
            usuario_id=usuario.id,
            acao="Importacao",
            tabela="Movimentacao",
            detalhes={"arquivo": nome_arquivo, "contratante": nome_contratante_bd, "linhas": linhas_importadas},
            request=request
        )

        conexao.commit()
        conexao.close()

        return {
            "sucesso": True,
            "tipo": "base_movimentacao",
            "mensagem": f"Sucesso! Arquivo mapeado para o Contratante '{nome_contratante_bd}'. {linhas_importadas} registros importados."
        }

    except Exception as e:
        if conexao:
            conexao.rollback()
            conexao.close()
        return {"sucesso": False, "mensagem": f"Erro interno ao importar base: {str(e)}"}

async def processar_importacao_movimentacoes_folha(
    conteudo: bytes,
    nome_arquivo: str,
    banco: str,
    usuario: UsuarioToken,
    request: Request,
):
    conexao = None
    try:
        df = pd.read_excel(io.BytesIO(conteudo), sheet_name="FOLHA_PAGAMENTO")
        df.columns = [c.strip() for c in df.columns]

        mapeamento_colunas = {
            "contratante": "CONTRATANTE",
            "unidadeRegistro": "UNIDADE REGISTRO",
            "unidadeAtuacao": "UNIDADE ATUACAO",
            "nome": "NOME",
            "cpf": "CPF",
            "dataNascimento": "DATA NASCIMENTO",
            "cboCargo": "CBO CARGO",
            "cargo": "CARGO",
            "departamento": "DEPARTAMENTO",
            "dataAdmissao": "DATA ADMISSAO",
            "descricao": "DESCRICAO",
            "dataCompetencia": "DATA COMPETENCIA",
            "dataCaixa": "DATA CAIXA",
            "tipo": "TIPO",
            "valor": "VALOR",
            "planoConta": "PLANO DE CONTA",
            "grupoConta": "GRUPO DE CONTA"
        }

        # 1. Validação da coluna Contratante
        if mapeamento_colunas["contratante"] not in df.columns:
            return {
                "sucesso": False,
                "mensagem": f"Erro: A coluna '{mapeamento_colunas['contratante']}' não foi encontrada no Excel.",
            }

        primeira_linha = df.iloc[0] if not df.empty else None
        nome_contratante_excel = (
            str(primeira_linha[mapeamento_colunas["contratante"]]).strip()
            if primeira_linha is not None
            else ""
        )

        if not nome_contratante_excel or nome_contratante_excel.upper() in [
            "NAN",
            "NONE",
        ]:
            return {
                "sucesso": False,
                "mensagem": "Erro: O nome do contratante na primeira linha do Excel está vazio ou inválido.",
            }

        # Conecta ao banco de dados
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        # 2. Validação e Status do Contratante
        cursor.execute(
            """
            SELECT id, nome, status FROM dbo.Contratante 
            WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?))
        """,
            (nome_contratante_excel,),
        )

        contratante_validado = cursor.fetchone()
        if not contratante_validado:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Importação Bloqueada! O contratante '{nome_contratante_excel}' não está cadastrado no sistema.",
            }

        contratante_id = contratante_validado[0]
        nome_contratante_bd = contratante_validado[1]
        raw_status = contratante_validado[2]
        status_contratante = int(raw_status) if raw_status is not None else 1

        if status_contratante != 1:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Importação Bloqueada! O contratante '{nome_contratante_bd}' está INATIVO no sistema.",
            }

        # 3. Lógica de Lote (Substituição ou Novo Lote em MovimentacaoFolhaPagamento)
        cursor.execute(
            """
            SELECT id FROM dbo.ImportacaoLote 
            WHERE nomeArquivo = ? AND contratanteId = ?
        """,
            (nome_arquivo, contratante_id),
        )
        lote_existente = cursor.fetchone()

        if lote_existente:
            lote_id = lote_existente[0]
            cursor.execute(
                "DELETE FROM dbo.MovimentacaoFolhaPagamento WHERE importacaoLoteId = ?",
                (lote_id,),
            )
        else:
            cursor.execute(
                """
                INSERT INTO dbo.ImportacaoLote (nomeArquivo, contratanteId) 
                VALUES (?, ?)
            """,
                (nome_arquivo, contratante_id),
            )
            cursor.execute("SELECT @@IDENTITY")
            lote_id = int(cursor.fetchone()[0])

        # 4. Validação de Colunas Obrigatórias e Células Vazias
        chaves_obrigatorias = ["contratante", "planoConta", "dataCompetencia"]
        colunas_faltantes = [
            mapeamento_colunas[ch]
            for ch in chaves_obrigatorias
            if mapeamento_colunas[ch] not in df.columns
        ]

        if colunas_faltantes:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Erro: O Excel não possui as colunas obrigatórias: {', '.join(colunas_faltantes)}.",
            }

        erros_celulas_vazias = []
        for index, row in df.iterrows():
            linha_excel = index + 2
            for chave in chaves_obrigatorias:
                col_nome = mapeamento_colunas[chave]
                valor = row.get(col_nome)
                if (
                    pd.isna(valor)
                    or str(valor).strip() == ""
                    or str(valor).strip().upper() in ["NAN", "NONE"]
                ):
                    erros_celulas_vazias.append(
                        f"Linha {linha_excel}: A coluna '{col_nome}' não pode ficar em branco."
                    )
            if len(erros_celulas_vazias) >= 5:
                break

        if erros_celulas_vazias:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": "Importação Bloqueada! Existem campos obrigatórios em branco:\n"
                + "\n".join(erros_celulas_vazias),
            }

        # 5. Validação de Datas (dataCompetencia)
        col_data_excel = mapeamento_colunas["dataCompetencia"]
        erros_data = []
        for index, row in df.iterrows():
            valor_data = row[col_data_excel]
            linha_excel = index + 2
            if pd.isna(valor_data):
                erros_data.append(
                    f"Linha {linha_excel}: Data de Competência está em branco."
                )
                continue
            try:
                if not isinstance(valor_data, pd.Timestamp):
                    pd.to_datetime(
                        str(valor_data).strip(), dayfirst=True, errors="raise"
                    )
            except Exception:
                erros_data.append(
                    f"Linha {linha_excel}: O valor '{valor_data}' na Data de Competência não é válido."
                )
            if len(erros_data) >= 5:
                break

        if erros_data:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": "Erro de validação nas datas de competência:\n"
                + "\n".join(erros_data),
            }

        # 6. Validação do Plano de Contas
        cursor.execute("SELECT UPPER(TRIM(planoConta)) FROM dbo.PlanoContas")
        planos_no_banco = {
            normalizar_texto(row[0]) for row in cursor.fetchall()
        }

        erros_encontrados = []
        for index, row_data in df.iterrows():
            conta_excel = normalizar_texto(
                str(row_data.get(mapeamento_colunas["planoConta"], ""))
            )
            if conta_excel and conta_excel not in ["NAN", "NONE"]:
                if conta_excel not in planos_no_banco:
                    erros_encontrados.append(
                        f"Linha {index + 2}: O plano de contas '{row_data.get(mapeamento_colunas['planoConta'])}' não está cadastrado no sistema."
                    )
            if len(erros_encontrados) >= 5:
                break

        if erros_encontrados:
            conexao.close()
            return {
                "sucesso": False,
                "mensagem": f"Importação bloqueada! Erros no Plano de Contas:\n"
                + "\n".join(erros_encontrados),
            }

        # Função interna de conversão e extração de dados
        def obtener_valor(row_data, coluna_excel, tipo_dado="string"):
            col_real = mapeamento_colunas.get(coluna_excel)
            if col_real and col_real in df.columns and pd.notna(row_data[col_real]):
                if tipo_dado == "data":
                    valor = row_data[col_real]
                    if isinstance(valor, (pd.Timestamp, datetime, date)):
                        str_data = valor.strftime("%d/%m/%Y")
                    else:
                        str_data = str(valor).strip()
                    dt = pd.to_datetime(
                        str_data, format="%d/%m/%Y", errors="coerce"
                    )
                    if pd.isna(dt):
                        dt = pd.to_datetime(row_data[col_real], dayfirst=True)
                    return dt.to_pydatetime() if pd.notna(dt) else None

                if tipo_dado == "float":
                    try:
                        return Decimal(
                            "{:.2f}".format(float(row_data[col_real]))
                        )
                    except:
                        return Decimal("0.00")

                valor_str = str(row_data[col_real]).strip()
                return valor_str if valor_str.upper() not in ["NAN", "NONE"] else None

            return Decimal("0.00") if tipo_dado == "float" else None

        # 7. Laço de Inserção na Tabela MovimentacaoFolhaPagamento
        linhas_importadas = 0
        for _, row in df.iterrows():
            unidade_reg_nome = obtener_valor(row, "unidadeRegistro")
            unidade_atu_nome = obtener_valor(row, "unidadeAtuacao")

            # Unidade Registro
            if unidade_reg_nome:
                cursor.execute(
                    "SELECT id FROM dbo.Unidade WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?)) AND contratanteId = ?",
                    (unidade_reg_nome, contratante_id),
                )
                u_row = cursor.fetchone()
                unidade_reg_id = u_row[0] if u_row else None
                if not unidade_reg_id:
                    cursor.execute(
                        "INSERT INTO dbo.Unidade (nome, contratanteId) VALUES (?, ?)",
                        (unidade_reg_nome, contratante_id),
                    )
                    cursor.execute("SELECT @@IDENTITY")
                    unidade_reg_id = int(cursor.fetchone()[0])
            else:
                unidade_reg_id = None

            # Unidade Atuação
            if unidade_atu_nome:
                cursor.execute(
                    "SELECT id FROM dbo.Unidade WHERE UPPER(TRIM(nome)) = UPPER(TRIM(?)) AND contratanteId = ?",
                    (unidade_atu_nome, contratante_id),
                )
                u_row = cursor.fetchone()
                unidade_atu_id = u_row[0] if u_row else None
                if not unidade_atu_id:
                    cursor.execute(
                        "INSERT INTO dbo.Unidade (nome, contratanteId) VALUES (?, ?)",
                        (unidade_atu_nome, contratante_id),
                    )
                    cursor.execute("SELECT @@IDENTITY")
                    unidade_atu_id = int(cursor.fetchone()[0])
            else:
                unidade_atu_id = unidade_reg_id

            # PlanoContas
            p_conta_raw = str(row[mapeamento_colunas["planoConta"]]).strip() if pd.notna(row.get(mapeamento_colunas["planoConta"])) else None
            p_conta_norm = normalizar_texto(p_conta_raw) if p_conta_raw else None

            has_grupo = "grupoConta" in mapeamento_colunas and mapeamento_colunas["grupoConta"] in df.columns
            g_conta_raw = str(row[mapeamento_colunas["grupoConta"]]).strip() if has_grupo and pd.notna(row.get(mapeamento_colunas["grupoConta"])) else None
            g_conta_norm = normalizar_texto(g_conta_raw) if g_conta_raw else None

            plano_conta_id = None

            if p_conta_raw and p_conta_raw.upper() not in ["NAN", "NONE"]:
                # 1ª Tentativa: Busca combinando Plano + Grupo (priorizando efolha ativo)
                if g_conta_raw and g_conta_raw.upper() not in ["NAN", "NONE"]:
                    cursor.execute("""
                        SELECT id FROM dbo.PlanoContas 
                        WHERE UPPER(TRIM(REPLACE(planoConta, CHAR(160), ' '))) = UPPER(TRIM(REPLACE(?, CHAR(160), ' ')))
                          AND UPPER(TRIM(REPLACE(grupoConta, CHAR(160), ' '))) = UPPER(TRIM(REPLACE(?, CHAR(160), ' ')))
                        ORDER BY CASE WHEN UPPER(TRIM(efolha)) <> 'NAO APLICA' THEN 1 ELSE 2 END
                    """, (p_conta_raw, g_conta_raw))
                    plano_row = cursor.fetchone()
                    if plano_row:
                        plano_conta_id = plano_row[0]

                # 2ª Tentativa: Busca apenas pelo Plano (priorizando efolha ativo)
                if not plano_conta_id:
                    cursor.execute("""
                        SELECT id FROM dbo.PlanoContas 
                        WHERE UPPER(TRIM(REPLACE(planoConta, CHAR(160), ' '))) = UPPER(TRIM(REPLACE(?, CHAR(160), ' ')))
                        ORDER BY CASE WHEN UPPER(TRIM(efolha)) <> 'NAO APLICA' THEN 1 ELSE 2 END
                    """, (p_conta_raw,))
                    plano_row = cursor.fetchone()
                    if plano_row:
                        plano_conta_id = plano_row[0]

                # 3ª Tentativa (Fallback por Collation/Sem acentos, priorizando efolha ativo):
                if not plano_conta_id:
                    cursor.execute("""
                        SELECT id FROM dbo.PlanoContas 
                        WHERE planoConta COLLATE Latin1_General_CI_AI = ?
                        ORDER BY CASE WHEN UPPER(TRIM(efolha)) <> 'NAO APLICA' THEN 1 ELSE 2 END
                    """, (p_conta_norm,))
                    plano_row = cursor.fetchone()
                    if plano_row:
                        plano_conta_id = plano_row[0]

            # Inserção na MovimentacaoFolhaPagamento
            cursor.execute(
                """
                INSERT INTO dbo.MovimentacaoFolhaPagamento (
                    unidadeRegistroId, unidadeAtuacaoId, nome, cpf, dataNascimento, 
                    cboCargo, cargo, departamento, dataAdmissao, descricao, 
                    planoContaId, dataCompetencia, dataCaixa, tipo, valor, importacaoLoteId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    unidade_reg_id,
                    unidade_atu_id,
                    obtener_valor(row, "nome"),
                    obtener_valor(row, "cpf"),
                    obtener_valor(row, "dataNascimento", "data"),
                    obtener_valor(row, "cboCargo"),
                    obtener_valor(row, "cargo"),
                    obtener_valor(row, "departamento"),
                    obtener_valor(row, "dataAdmissao", "data"),
                    obtener_valor(row, "descricao"),
                    plano_conta_id,
                    obtener_valor(row, "dataCompetencia", "data"),
                    obtener_valor(row, "dataCaixa", "data"),
                    obtener_valor(row, "tipo"),
                    obtener_valor(row, "valor", "float"),
                    lote_id,
                ),
            )
            linhas_importadas += 1

        # Registro do Log
        registrar_log(
            usuario_id=usuario.id,
            acao="Importacao",
            tabela="MovimentacaoFolhaPagamento",
            detalhes={
                "arquivo": nome_arquivo,
                "contratante": nome_contratante_bd,
                "linhas": linhas_importadas,
            },
            request=request,
        )

        conexao.commit()
        conexao.close()

        return {
            "sucesso": True,
            "tipo": "base_folha_pagamento",
            "mensagem": f"Sucesso! Arquivo de Folha mapeado para o Contratante '{nome_contratante_bd}'. {linhas_importadas} registros importados.",
        }

    except Exception as e:
        if conexao:
            conexao.rollback()
            conexao.close()
        return {
            "sucesso": False,
            "mensagem": f"Erro interno ao importar base da folha: {str(e)}",
        }