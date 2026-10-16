const express = require('express');
const pool = require('./db');
const app = express();

app.use(express.json());

// LISTAR tarefas (com filtro opcional por status)
app.get('/tarefas', async (req, res) => {
  try {
    const { concluida } = req.query; 
    //  ENTRADA NÃO VALIDADA: req.query.concluida
    // Não valida se o parâmetro enviado é realmente válido. 
    // Se o usuário passar ?concluida=sim ou ?concluida=123, a expressão (concluida === 'true') 
    // converterá silenciosamente para 'false', sem alertar o usuário sobre o valor incorreto.

    let query = 'SELECT * FROM tarefas';
    let params = [];

    if (concluida !== undefined) {
      query += ' WHERE concluida = $1';
      params.push(concluida === 'true');
    }

    query += ' ORDER BY id';

    const resultado = await pool.query(query, params);
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar tarefas' });
  }
});

// BUSCAR uma tarefa específica
app.get('/tarefas/:id', async (req, res) => {
  try {
    //  ENTRADA NÃO VALIDADA: req.params.id
    // Não checa se 'id' é um número inteiro válido antes de enviar ao banco.
    // Se o usuário acessar GET /tarefas/abc, o PostgreSQL lança um erro de tipo,
    // caindo no catch e retornando 500 em vez de 400 (Bad Request).
    const resultado = await pool.query('SELECT * FROM tarefas WHERE id = $1', [req.params.id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa nao encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar tarefa' });
  }
});

// CRIAR uma nova tarefa
app.post('/tarefas', async (req, res) => {
  try {
    const { titulo } = req.body;

    //  ENTRADA PARCIALMENTE CHECADA: req.body.titulo
    // 1. Apensa checa a existência com (!titulo). Se o usuário enviar "   " (espaços vazios), 
    //    passa pelo teste e cria uma tarefa sem nome no banco (falta .trim()).
    // 2. Não checa se 'titulo' é uma string (pode receber números, arrays ou booleanos).
    // 3. Não limita o tamanho máximo do texto (estouro de limite do banco).
    if (!titulo) return res.status(400).json({ erro: 'O campo "titulo" e obrigatorio' });

    const resultado = await pool.query(
      'INSERT INTO tarefas (titulo) VALUES ($1) RETURNING *',
      [titulo]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar tarefa' });
  }
});

// ATUALIZAR uma tarefa
app.put('/tarefas/:id', async (req, res) => {
  try {
    const { titulo, concluida } = req.body;

    //  ENTRADA NÃO VALIDADA: req.params.id
    // Não valida se o ID é numérico antes de realizar a busca inicial.
    const tarefaAtual = await pool.query('SELECT * FROM tarefas WHERE id = $1', [req.params.id]);

    if (tarefaAtual.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa nao encontrada' });
    }

    const atual = tarefaAtual.rows[0];

    //  ENTRADAS NÃO VALIDADAS NO CORPO (req.body):
    // 1. 'titulo': Aceita strings com apenas espaços vazios ("   ") e não valida se o tipo é string.
    // 2. 'concluida': Não valida se é realmente um booleano (aceita números, textos ou objetos).
    // 3. Não verifica se o corpo req.body veio totalmente vazio {}.
    const novoTitulo = titulo !== undefined ? titulo : atual.titulo;
    const novaConcluida = concluida !== undefined ? concluida : atual.concluida;

    const resultado = await pool.query(
      'UPDATE tarefas SET titulo = $1, concluida = $2 WHERE id = $3 RETURNING *',
      [novoTitulo, novaConcluida, req.params.id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
  }
});

// DELETAR uma tarefa
app.delete('/tarefas/:id', async (req, res) => {
  try {
    //  ENTRADA NÃO VALIDADA: req.params.id
    // Não valida se 'id' é um número inteiro antes de tentar a exclusão no banco.
    // Enviar DELETE /tarefas/abc fará o banco falhar e cair no catch com erro 500.
    const resultado = await pool.query('DELETE FROM tarefas WHERE id = $1 RETURNING *', [req.params.id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa nao encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao deletar tarefa' });
  }
});

app.listen(3000, () => console.log('API rodando na porta 3000'));