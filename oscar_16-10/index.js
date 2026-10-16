const express = require('express');
const pool = require('./db');
const app = express();

app.use(express.json());

// -----------------------------------------------------------------------------
// FUNÇÕES AUXILIARES DE VALIDAÇÃO
// -----------------------------------------------------------------------------

// Valida e sanitiza o ID passado nas rotas (/tarefas/:id)
function validarId(idParam) {
  const idNum = Number(idParam);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return { valido: false, erro: 'O ID fornecido deve ser um número inteiro positivo.' };
  }
  return { valido: true, id: idNum };
}

// Valida tipo, presença, espaços vazios e tamanho máximo do título
function validarTitulo(titulo) {
  if (typeof titulo !== 'string') {
    return { valido: false, erro: 'O campo "titulo" deve ser do tipo texto (string).' };
  }

  const tituloFormatado = titulo.trim();

  if (tituloFormatado.length === 0) {
    return { valido: false, erro: 'O campo "titulo" não pode estar vazio ou conter apenas espaços.' };
  }

  if (tituloFormatado.length > 255) {
    return { valido: false, erro: 'O campo "titulo" não pode ter mais de 255 caracteres.' };
  }

  return { valido: true, tituloFormatado };
}


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
    const checagemId = validarId(req.params.id);
    if (!checagemId.valido) {
      return res.status(400).json({ erro: checagemId.erro });
    }

    const resultado = await pool.query('SELECT * FROM tarefas WHERE id = $1', [checagemId.id]);
    
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

    const checagemTitulo = validarTitulo(titulo);
    if (!checagemTitulo.valido) {
      return res.status(400).json({ erro: checagemTitulo.erro });
    }

    const resultado = await pool.query(
      'INSERT INTO tarefas (titulo) VALUES ($1) RETURNING *',
      [checagemTitulo.tituloFormatado]
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
    const checagemId = validarId(req.params.id);
    if (!checagemId.valido) {
      return res.status(400).json({ erro: checagemId.erro });
    }

    const { titulo, concluida } = req.body;

    if (titulo === undefined && concluida === undefined) {
      return res.status(400).json({ erro: 'Forneça ao menos o campo "titulo" ou "concluida" para atualizar.' });
    }

    const tarefaAtual = await pool.query('SELECT * FROM tarefas WHERE id = $1', [checagemId.id]);
    if (tarefaAtual.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    const atual = tarefaAtual.rows[0];
    let novoTitulo = atual.titulo;
    let novaConcluida = atual.concluida;

    // Validação do título caso fornecido no body
    if (titulo !== undefined) {
      const checagemTitulo = validarTitulo(titulo);
      if (!checagemTitulo.valido) {
        return res.status(400).json({ erro: checagemTitulo.erro });
      }
      novoTitulo = checagemTitulo.tituloFormatado;
    }

    // Validação do campo concluída caso fornecido no body
    if (concluida !== undefined) {
      if (typeof concluida !== 'boolean') {
        return res.status(400).json({ erro: 'O campo "concluida" deve ser do tipo booleano (true ou false).' });
      }
      novaConcluida = concluida;
    }

    const resultado = await pool.query(
      'UPDATE tarefas SET titulo = $1, concluida = $2 WHERE id = $3 RETURNING *',
      [novoTitulo, novaConcluida, checagemId.id]
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
    const checagemId = validarId(req.params.id);
    if (!checagemId.valido) {
      return res.status(400).json({ erro: checagemId.erro });
    }

    const resultado = await pool.query('DELETE FROM tarefas WHERE id = $1 RETURNING *', [checagemId.id]);

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