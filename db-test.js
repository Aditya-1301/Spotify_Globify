const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split(/\r?\n/);
let dbUrl, dbToken;
for(const line of lines) {
  if (line.startsWith('TURSO_DATABASE_URL=')) dbUrl = line.split('=')[1].replace(/\"/g, '');
  if (line.startsWith('TURSO_AUTH_TOKEN=')) dbToken = line.split('=')[1].replace(/\"/g, '');
}
const { createClient } = require('@libsql/client');
const db = createClient({ url: dbUrl, authToken: dbToken });
db.execute('SELECT count(*) as total, sum(case when genres is not null then 1 else 0 end) as has_genre, sum(case when genres = \'\' then 1 else 0 end) as empty_genre FROM artists').then(r => console.log(r.rows)).catch(console.error);
