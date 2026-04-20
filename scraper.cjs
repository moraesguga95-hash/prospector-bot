const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pauyzimjlrjoncbvgkdh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXl6aW1qbHJqb25jYnZna2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDI2NDksImV4cCI6MjA5MjAxODY0OX0.XUO9j9AYMcB4n-1DpFh5HGLAdah-rVv94BGE3KE7XBE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeGoogleMaps(query) {
  console.log(`📡 Iniciando varredura: ${query}`);
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.Nv2PK'));
      return items.map(item => {
        const name = item.querySelector('.qBF1Pd')?.innerText || "Sem nome";
        const rating = parseFloat((item.querySelector('.MW4etd')?.innerText || "0").replace(',', '.'));
        const reviews = parseInt((item.querySelector('.UY7F9')?.innerText || "0").replace(/\D/g, '')) || 0;
        const website = item.querySelector('a[aria-label*="Website"]')?.href || null;
        const phone = item.innerText.match(/\(?\d{2}\)?\s?\d{4,5}[-.]?\d{4}/)?.[0] || "";
        const category = item.querySelector('.W4Efsd:nth-child(2) span:nth-child(1)')?.innerText || "Geral";
        return { name, rating, reviews, website, phone, category };
      });
    });

    // Calcula benchmarks
    const avgRating = results.length > 0 ? results.reduce((acc, l) => acc + l.rating, 0) / results.length : 0;
    const topCompetitor = [...results].sort((a, b) => b.rating - a.rating)[0];

    console.log(`✅ ${results.length} empresas encontradas. Enviando para Supabase...`);

    for (const lead of results) {
      let score = 0;
      if (!lead.website) score += 40;
      if (lead.rating < 4.2) score += 30;
      if (lead.reviews < 20) score += 20;
      if (lead.phone) score += 10;

      const leadObj = {
        name: lead.name,
        phone: lead.phone || null,
        website: lead.website || null,
        rating: lead.rating,
        reviews: lead.reviews,
        category: lead.category,
        score: score,
        status: 'Pendente',
        competitor: topCompetitor?.name || 'Líder Local',
        competitorRating: topCompetitor?.rating || 4.8,
        avgRatingNiche: avgRating.toFixed(1),
        lastUpdated: new Date().toISOString()
      };

      const { error } = await supabase.from('leads').upsert(leadObj, { onConflict: 'name' });
      if (error) console.error(`❌ Erro: ${lead.name} — ${error.message}`);
      else console.log(`   ✅ ${lead.name} (Score: ${score})`);
    }

    console.log(`🏁 Varredura completa!`);
  } catch (err) {
    console.error('Erro na varredura:', err.message);
  }

  await browser.close();
}

module.exports = { scrapeGoogleMaps };
