const express = require('express');
const cors = require('cors');
const { scrapeGoogleMaps } = require('./scraper.cjs');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/', (req, res) => res.json({ status: 'online', service: 'Prospector Bot Cloud' }));
app.get('/api/health', (req, res) => res.json({ status: 'online', timestamp: new Date().toISOString() }));

// Varredura automática
app.post('/api/scrape', (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Informe o que buscar.' });

  console.log(`🚀 Comando recebido: ${query}`);
  res.json({ message: 'Varredura iniciada!', query });

  // Executa em background (não bloqueia a resposta)
  scrapeGoogleMaps(query).catch(err => console.error('Erro:', err));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`\n🤖 PROSPECTOR BOT CLOUD rodando na porta ${port}`);
  console.log(`   Aguardando comandos...\n`);
});
