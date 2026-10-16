const express = require('express');
const pool = require('./db');
const app = express();

app.use(express.json());

// LISTAR tarefas com filtro opcional por status e PAGINAÇÃO (LIMIT/OFFSET)
app.get('/tarefas', async (req, res) => {
    try {
        const { concluida, pagina = 1, limite = 10 } = req.query;

        // Converter para números inteiros com valores padrão de segurança
        const numPagina = Math.max(1, parseInt(pagina) || 1);
        const numLimite = Math.max(1, parseInt(limite) || 10);
        
        // Calcular o deslocamento (OFFSET)
        const offset = (numPagina - 1) * numLimite;

        let query = 'SELECT * FROM tarefas';
        let params = [];

        // Filtro por status (concluída)
        if (concluida !== undefined) {
            query += ' WHERE concluida = $1';
            params.push(concluida === 'true');
        }

        query += ' ORDER BY id';

        // Adicionar LIMIT e OFFSET utilizando os próximos índices de parâmetros SQL ($1, $2, etc.)
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


// 2. ESTATÍSTICAS das tarefas (deve ficar fora de /tarefas e ANTES de /tarefas/:id)
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

// 3. BUSCAR uma tarefa específica
app.get('/tarefas/:id', async (req, res) => {
    try {
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

// 4. CRIAR uma nova tarefa
app.post('/tarefas', async (req, res) => {
    try {
        const { titulo } = req.body;
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

// 5. ATUALIZAR uma tarefa
app.put('/tarefas/:id', async (req, res) => {
    try {
        const { titulo, concluida } = req.body;
        const tarefaAtual = await pool.query('SELECT * FROM tarefas WHERE id = $1', [req.params.id]);
        if (tarefaAtual.rows.length === 0) {
            return res.status(404).json({ erro: 'Tarefa nao encontrada' });
        }
        const atual = tarefaAtual.rows[0];
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

// 6. DELETAR uma tarefa
app.delete('/tarefas/:id', async (req, res) => {
    try {
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