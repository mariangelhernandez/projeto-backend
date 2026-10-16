const express = require('express');
const pool = require('./db');
const app = express();

app.use(express.json());

// 1. LISTAR tarefas com filtro por status e paginação
app.get('/tarefas', async (req, res) => {
  try {
    const { concluida, pagina = 1, limite = 10 } = req.query;

    const numPagina = Math.max(1, parseInt(pagina, 10) || 1);
    const numLimite = Math.max(1, parseInt(limite, 10) || 10);
    const offset = (numPagina - 1) * numLimite;

    let query = 'SELECT * FROM tarefas';
    let params = [];

    if (concluida !== undefined) {
      query += ' WHERE concluida = $1';
      params.push(concluida === 'true');
    }

    query += ' ORDER BY id';

    const idxLimite = params.length + 1;
    const idxOffset = params.length + 2;

    query += ` LIMIT $${idxLimite} OFFSET $${idxOffset}`;
    params.push(numLimite, offset);

    const resultado = await pool.query(query, params);

    res.json({
      paginaAtual: numPagina,
      itensPorPagina: numLimite,
      totalRetornado: resultado.rows.length,
      dados: resultado.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar tarefas' });
  }
});

// 2. ESTATÍSTICAS das tarefas (Posicionada antes de /tarefas/:id)
app.get('/tarefas/estatisticas', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT concluida, COUNT(*) AS total FROM tarefas GROUP BY concluida'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao obter estatísticas' });
  }
});

// 3. BUSCAR uma tarefa específica pelo ID
app.get('/tarefas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Validação do ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'O ID deve ser um número inteiro positivo.' });
    }

    const resultado = await pool.query('SELECT * FROM tarefas WHERE id = $1', [id]);
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar tarefa' });
  }
});

// 4. CRIAR uma nova tarefa
app.post('/tarefas', async (req, res) => {
  try {
    const { titulo } = req.body;

    // Validação de tipo e de conteúdo vazio
    if (typeof titulo !== 'string' || titulo.trim().length === 0) {
      return res.status(400).json({ erro: 'O campo "titulo" é obrigatório e deve ser um texto válido.' });
    }

    // Validação de tamanho máximo
    if (titulo.trim().length > 255) {
      return res.status(400).json({ erro: 'O campo "titulo" deve ter no máximo 255 caracteres.' });
    }

    const tituloFormatado = titulo.trim();

    const resultado = await pool.query(
      'INSERT INTO tarefas (titulo) VALUES ($1) RETURNING *',
      [tituloFormatado]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar tarefa' });
  }
});

// 5. ATUALIZAR uma tarefa existente
app.put('/tarefas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Validação do ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'O ID deve ser um número inteiro positivo.' });
    }

    const { titulo, concluida } = req.body;

    // Garante que o corpo não veio vazio
    if (titulo === undefined && concluida === undefined) {
      return res.status(400).json({ erro: 'Forneça ao menos o campo "titulo" ou "concluida" para atualizar.' });
    }

    // Busca a tarefa atual no banco
    const tarefaAtual = await pool.query('SELECT * FROM tarefas WHERE id = $1', [id]);
    if (tarefaAtual.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    const atual = tarefaAtual.rows[0];
    let novoTitulo = atual.titulo;
    let novaConcluida = atual.concluida;

    // Validação do título caso tenha sido fornecido
    if (titulo !== undefined) {
      if (typeof titulo !== 'string' || titulo.trim().length === 0) {
        return res.status(400).json({ erro: 'O campo "titulo" deve ser um texto válido e não pode ser vazio.' });
      }
      if (titulo.trim().length > 255) {
        return res.status(400).json({ erro: 'O campo "titulo" deve ter no máximo 255 caracteres.' });
      }
      novoTitulo = titulo.trim();
    }

    // Validação do campo concluída caso tenha sido fornecido
    if (concluida !== undefined) {
      if (typeof concluida !== 'boolean') {
        return res.status(400).json({ erro: 'O campo "concluida" deve ser do tipo booleano (true ou false).' });
      }
      novaConcluida = concluida;
    }

    const resultado = await pool.query(
      'UPDATE tarefas SET titulo = $1, concluida = $2 WHERE id = $3 RETURNING *',
      [novoTitulo, novaConcluida, id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
  }
});

// 6. DELETAR uma tarefa
app.delete('/tarefas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Validação do ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'O ID deve ser um número inteiro positivo.' });
    }

    const resultado = await pool.query('DELETE FROM tarefas WHERE id = $1 RETURNING *', [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao deletar tarefa' });
  }
});

app.listen(3000, () => console.log('API rodando na porta 3000'));