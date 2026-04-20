const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pauyzimjlrjoncbvgkdh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXl6aW1qbHJqb25jYnZna2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDI2NDksImV4cCI6MjA5MjAxODY0OX0.XUO9j9AYMcB4n-1DpFh5HGLAdah-rVv94BGE3KE7XBE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeGoogleMaps(query) {
  console.log(`📡 BUSCA EM ANDAMENTO: ${query}`);
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1600,900'] 
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Rolagem para garantir que os leads carreguem
    for(let i=0; i<6; i++) {
        await page.evaluate(() => {
          const scrollable = document.querySelector('div[role="feed"]') || document.querySelector('.m6QC6e');
          if (scrollable) scrollable.scrollBy(0, 1500);
        });
        await new Promise(r => setTimeout(r, 2000));
    }

    const leads = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.Nv2PK'));
      return items.map(item => {
        const name = item.querySelector('.qBF1Pd')?.innerText || "Sem nome";
        const rating = parseFloat((item.querySelector('.MW4etd')?.innerText || "0").replace(',', '.'));
        const website = item.querySelector('a[aria-label*="Website"]')?.href || null;
        const category = item.querySelector('.W4Efsd:nth-child(2) span:nth-child(1)')?.innerText || "Geral";
        
        const textContent = item.innerText;
        const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\.\s]?\d{4}/g;
        const phones = textContent.match(phoneRegex);
        const phone = phones ? phones[0].trim() : "";
        
        return { name, rating, website, phone, category };
      });
    });

    console.log(`🔍 Encontrados ${leads.length} leads. Salvando na nuvem...`);

    for (let lead of leads) {
      if (lead.name === "Sem nome" || !lead.phone) continue;

      let score = 0;
      if (!lead.website) score += 50;
      if (lead.rating < 4.5) score += 30;
      if (lead.phone) score += 20;

      // Upsert garantido
      const { error } = await supabase.from('leads').upsert({
        ...lead,
        score,
        cadence_step: 1, // Começa no estágio de Abordagem
        status: 'Pendente',
        lastUpdated: new Date().toISOString()
      }, { onConflict: 'name' });
      
      if (!error) console.log(`✅ Sucesso: ${lead.name}`);
    }

    console.log(`🏁 Varredura concluída com sucesso!`);
  } catch (err) {
    console.error('ERRO CRÍTICO NO ROBÔ:', err.message);
  }

  await browser.close();
}

module.exports = { scrapeGoogleMaps };
