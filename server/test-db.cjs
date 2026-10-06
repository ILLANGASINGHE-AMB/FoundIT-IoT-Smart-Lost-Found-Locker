require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionTimeoutMillis: 5000,
})

async function testConnection() {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS server_time'
    )

    console.log('Database connected successfully!')
    console.table(result.rows)
  } catch (error) {
    console.error('Connection failed:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

testConnection()