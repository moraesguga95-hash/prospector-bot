const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pauyzimjlrjoncbvgkdh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXl6aW1qbHJqb25jYnZna2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDI2NDksImV4cCI6MjA5MjAxODY0OX0.XUO9j9AYMcB4n-1DpFh5HGLAdah-rVv94BGE3KE7XBE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeGoogleMaps(query) {
  console.log(`📡 SUPER-VARREDURA: ${query}`);
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });
    
    // Rolagem profunda para carregar tudo
    for(let i=0; i<5; i++) {
        await page.evaluate(() => document.querySelector('.m6QC6e')?.scrollBy(0, 1500));
        await new Promise(r => setTimeout(r, 1500));
    }

    const leads = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.Nv2PK'));
      return items.map(item => {
        const name = item.querySelector('.qBF1Pd')?.innerText || "Sem nome";
        const rating = parseFloat((item.querySelector('.MW4etd')?.innerText || "0").replace(',', '.'));
        const reviews = parseInt((item.querySelector('.UY7F9')?.innerText || "0").replace(/\D/g, '')) || 0;
        const website = item.querySelector('a[aria-label*="Website"]')?.href || null;
        const category = item.querySelector('.W4Efsd:nth-child(2) span:nth-child(1)')?.innerText || "Geral";
        
        // Busca Telefone de múltiplas formas (Regex melhorado)
        const textContent = item.innerText;
        const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\.\s]?\d{4}/g;
        const phones = textContent.match(phoneRegex);
        const phone = phones ? phones[0].trim() : "";
        
        return { name, rating, reviews, website, phone, category };
      });
    });

    console.log(`🔍 Processando ${leads.length} leads encontrados...`);

    for (let lead of leads) {
      if (lead.name === "Sem nome") continue;

      let score = 0;
      if (!lead.website) score += 40;
      if (lead.rating < 4.3) score += 30;
      if (lead.reviews < 20) score += 20;
      if (lead.phone) score += 10;

      await supabase.from('leads').upsert({
        ...lead,
        score,
        status: 'Pendente',
        lastUpdated: new Date().toISOString()
      }, { onConflict: 'name' });
      
      console.log(`✅ Salvo: ${lead.name} | Tel: ${lead.phone || 'Nao encontrado'}`);
    }

    console.log(`🏁 Varredura finalizada.`);
  } catch (err) {
    console.error('Erro:', err.message);
  }

  await browser.close();
}

module.exports = { scrapeGoogleMaps };
