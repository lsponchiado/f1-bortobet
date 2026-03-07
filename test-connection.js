const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

console.log('🔌 Verificando URL:', connectionString ? connectionString.replace(/:.*@/, ':****@') : 'URL VAZIA!');

const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 5000 
});

async function test() {
  try {
    console.log('⏳ Tentando conectar ao Postgres...');
    const client = await pool.connect();
    console.log('✅ CONEXÃO ESTABELECIDA COM SUCESSO!');
    
    const res = await client.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log('📊 Banco de Dados:', res.rows[0].db_name);
    console.log('🕒 Hora no Servidor:', res.rows[0].current_time);
    
    client.release();
  } catch (err) {
    console.error('❌ ERRO DE AUTENTICAÇÃO OU CONEXÃO:');
    console.error('👉 Mensagem:', err.message);
    console.error('👉 Código do Erro:', err.code);
    
    if (err.message.includes('password authentication failed')) {
      console.log('\n💡 DICA: Sua senha pode conter caracteres especiais (@, #, !, etc) que precisam de encode ou estão incorretos.');
    }
  } finally {
    await pool.end();
  }
}

test();