/* ============================================================================
 *  EXERCÍCIO DE TREINO — ARQUIVO INTENCIONALMENTE VULNERÁVEL
 * ----------------------------------------------------------------------------
 *  Disciplina: Informática para Internet — Segurança em APIs REST
 *
 *  Todas as falhas e entradas não checadas foram corrigidas e comentadas
 *  diretamente no código abaixo com suas respectivas classificações OWASP.
 * ==========================================================================*/

require('dotenv').config(); // Carrega as variáveis de ambiente a partir do arquivo .env
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

/* ============================================================================
 * [FALHA 1] CREDENCIAIS HARDCODED NO CÓDIGO
 * ----------------------------------------------------------------------------
 * (a) Linha Original: password: 'admin123'
 * (b) Risco: Expor credenciais no código-fonte permite que qualquer pessoa com
 *     acesso ao repositório acesse a base de dados.
 * (c) Categoria OWASP: A07:2021 – Identification and Authentication Failures
 * (d) Correção: Leitura de dados sensíveis via process.env.
 * ==========================================================================*/
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD, // Lida com segurança do arquivo .env
  database: process.env.DB_NAME || 'tarefas_treino',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

// ---------------------------------------------------------------------------
// GET /tarefas — lista todas as tarefas
// ---------------------------------------------------------------------------
app.get('/tarefas', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT id, titulo, concluida FROM tarefas ORDER BY id');
    res.json(resultado.rows);
  } catch (error) {
    /* ========================================================================
     * [FALHA 2] VAZAMENTO DE INFORMAÇÕES SENSÍVEIS (STACK TRACES)
     * ------------------------------------------------------------------------
     * (a) Linha Original: res.status(500).json({ erro: error.message, stack: error.stack })
     * (b) Risco: Retornar o `stack trace` expõe detalhes da infraestrutura, do
     *     banco e das bibliotecas para potenciais atacantes.
     * (c) Categoria OWASP: A05:2021 – Security Misconfiguration
     * (d) Correção: Registra o erro detalhado internamente no servidor (log)
     *     e retorna uma mensagem genérica e segura para o cliente.
     * ======================================================================*/
    console.error('Erro em GET /tarefas:', error);
    res.status(500).json({ erro: 'Erro interno no servidor ao listar tarefas.' });
  }
});

// ---------------------------------------------------------------------------
// GET /tarefas/buscar?termo=... — busca tarefas pelo título
// ---------------------------------------------------------------------------
app.get('/tarefas/buscar', async (req, res) => {
  try {
    const { termo } = req.query;

    /* ========================================================================
     * [ENTRADA NÃO CHECADA]: req.query.termo
     * Validação prévia para garantir que o parâmetro existe e é uma string válida.
     * ======================================================================*/
    if (!termo || typeof termo !== 'string' || termo.trim() === '') {
      return res.status(400).json({ erro: 'O parâmetro "termo" é obrigatório e deve ser um texto válido.' });
    }

    /* ========================================================================
     * [FALHA 3] INJEÇÃO DE SQL (SQL INJECTION VIA GET)
     * ------------------------------------------------------------------------
     * (a) Linha Original: "SELECT * FROM tarefas WHERE titulo LIKE '%" + termo + "%'"
     * (b) Risco: Permite execução arbitrária de comandos SQL via parâmetro da URL.
     * (c) Categoria OWASP: A03:2021 – Injection
     * (d) Correção: Consulta parametrizada com placeholders ($1).
     * ======================================================================*/
    const sql = 'SELECT id, titulo, concluida FROM tarefas WHERE titulo ILIKE $1 ORDER BY id';
    const resultado = await pool.query(sql, [`%${termo.trim()}%`]);

    res.json(resultado.rows);
  } catch (error) {
    console.error('Erro em GET /tarefas/buscar:', error);
    res.status(500).json({ erro: 'Erro interno no servidor ao buscar tarefas.' });
  }
});

// ---------------------------------------------------------------------------
// POST /tarefas — cria uma tarefa
// ---------------------------------------------------------------------------
app.post('/tarefas', async (req, res) => {
  try {
    const { titulo } = req.body;

    /* ========================================================================
     * [ENTRADA NÃO CHECADA & FALHA 4] INJEÇÃO DE SQL E FALTA DE VALIDAÇÃO (POST)
     * ------------------------------------------------------------------------
     * (a) Linha Original: "INSERT INTO tarefas ... VALUES ('" + titulo + "', false)"
     * (b) Risco: SQL Injection através do corpo da requisição e inserção de dados
     *     inválidos/nulos no banco.
     * (c) Categoria OWASP: A03:2021 – Injection / A04:2021 – Insecure Design
     * (d) Correção: Validação do tipo e conteúdo de 'titulo' + consulta parametrizada ($1).
     * ======================================================================*/
    if (!titulo || typeof titulo !== 'string' || titulo.trim() === '') {
      return res.status(400).json({ erro: 'O campo "titulo" é obrigatório e deve ser um texto preenchido.' });
    }

    const sql = 'INSERT INTO tarefas (titulo, concluida) VALUES ($1, false) RETURNING id, titulo, concluida';
    const resultado = await pool.query(sql, [titulo.trim()]);

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Erro em POST /tarefas:', error);
    res.status(500).json({ erro: 'Erro interno no servidor ao criar tarefa.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /tarefas/:id — marca uma tarefa como concluída
// ---------------------------------------------------------------------------
app.put('/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idNumerico = parseInt(id, 10);

    /* ========================================================================
     * [ENTRADA NÃO CHECADA]: req.params.id
     * Validação para garantir que o ID passado na URL seja um número inteiro positivo.
     * ======================================================================*/
    if (isNaN(idNumerico) || idNumerico <= 0) {
      return res.status(400).json({ erro: 'O ID informado deve ser um número inteiro válido.' });
    }

    const resultado = await pool.query(
      'UPDATE tarefas SET concluida = true WHERE id = $1 RETURNING id, titulo, concluida',
      [idNumerico]
    );

    /* ========================================================================
     * [FALHA 5] FALTA DE VERIFICAÇÃO DE EXISTÊNCIA DO RECURSO (BROKEN ACCESS CONTROL)
     * ------------------------------------------------------------------------
     * (a) Linha Original: res.json(resultado.rows[0]) sem validação de retorno
     * (b) Risco: Retorna respostas incoerentes ou erros não tratados caso o ID não exista.
     * (c) Categoria OWASP: A01:2021 – Broken Access Control
     * (d) Correção: Verificar se `resultado.rowCount === 0` e responder com HTTP 404.
     * ======================================================================*/
    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Erro em PUT /tarefas/:id:', error);
    res.status(500).json({ erro: 'Erro interno no servidor ao atualizar tarefa.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /tarefas/:id — apaga uma tarefa
// ---------------------------------------------------------------------------
app.delete('/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idNumerico = parseInt(id, 10);

    /* ========================================================================
     * [ENTRADA NÃO CHECADA]: req.params.id
     * ======================================================================*/
    if (isNaN(idNumerico) || idNumerico <= 0) {
      return res.status(400).json({ erro: 'O ID informado deve ser um número inteiro válido.' });
    }

    /* ========================================================================
     * [FALHA 5 - CONTINUAÇÃO] RECURSO NÃO ENCONTRADO E CONSULTA INCOMPLETA
     * ------------------------------------------------------------------------
     * (a) Linha Original: DELETE executado sem try/catch adequado e sem validação
     * (b) Risco: Tentar deletar itens inexistentes sem retorno apropriado ao cliente.
     * (c) Categoria OWASP: A01:2021 – Broken Access Control
     * (d) Correção: Executar deleção parametrizada e verificar rowCount para retornar 404.
     * ======================================================================*/
    const resultado = await pool.query('DELETE FROM tarefas WHERE id = $1', [idNumerico]);

    if (resultado.rowCount === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Erro em DELETE /tarefas/:id:', error);
    res.status(500).json({ erro: 'Erro interno no servidor ao deletar tarefa.' });
  }
});

/* ============================================================================
 * [FALHA 6] CONFIGURAÇÃO DE SEGURANÇA, ROTAS INEXISTENTES E ERROS ASSÍNCRONOS
 * ----------------------------------------------------------------------------
 * (a) Linha Original: app.listen(3000, ...) sem middleware global de 404 e sem
 *     tratamento de exceções em rotas assíncronas.
 * (b) Risco: Exceções não capturadas em funções async podem derrubar a aplicação
 *     (Unhandled Rejections) e rotas não tratadas revelam comportamento padrão do Express.
 * (c) Categoria OWASP: A05:2021 – Security Misconfiguration
 * (d) Correção: Envolver todos os blocos assíncronos em try/catch, adicionar um
 *     middleware final para captura de rotas inexistentes (404) e ler a porta via env.
 * ==========================================================================*/

// Middleware para rotas inexistentes
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// ---------------------------------------------------------------------------
// Sobe o servidor
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de tarefas rodando na porta ${PORT}`);
});