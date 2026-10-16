CREATE DATABASE tarefas_db;

\c tarefas_db

CREATE TABLE tarefas (
 id SERIAL PRIMARY KEY,
 titulo VARCHAR(255) NOT NULL,
 concluida BOOLEAN DEFAU FALSE,
 criada_em TIMESTAMP DEFAULT NOW(LT)
);

ALTER TABLE tarefas ADD COLUMN prioridade VARCHAR(10) DEFAULT 'média';
 SELECT * FROM tarefas