const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pauyzimjlrjoncbvgkdh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdXl6aW1qbHJqb25jYnZna2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDI2NDksImV4cCI6MjA5MjAxODY0OX0.XUO9j9AYMcB4n-1DpFh5HGLAdah-rVv94BGE3KE7XBE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeGoogleMaps(query) {
  console.log(`📡 Operação "God Mode" iniciada: ${query}`);
  
  const browser = await puppeteer.launch({ 
    headless: "new", 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });
    
    // Scroll para carregar mais leads
    for(let i=0; i<3; i++) {
        await page.evaluate(() => document.querySelector('.m6QC6e')?.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 1000));
    }

    const leads = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.Nv2PK'));
      return items.map(item => {
        const name = item.querySelector('.qBF1Pd')?.innerText || "Empresa sem nome";
        const rating = parseFloat((item.querySelector('.MW4etd')?.innerText || "0").replace(',', '.'));
        const reviews = parseInt((item.querySelector('.UY7F9')?.innerText || "0").replace(/\D/g, '')) || 0;
        const website = item.querySelector('a[aria-label*="Website"]')?.href || null;
        const phone = item.innerText.match(/\(?\d{2}\)?\s?\d{4,5}[-.]?\d{4}/)?.[0] || "";
        const category = item.querySelector('.W4Efsd:nth-child(2) span:nth-child(1)')?.innerText || "Geral";
        const address = item.querySelector('.W4Efsd:nth-child(2) span:nth-child(2) span:nth-child(2)')?.innerText || "";
        
        return { name, rating, reviews, website, phone, category, address };
      });
    });

    console.log(`🔍 Analisando presença digital de ${leads.length} leads...`);

    for (let lead of leads) {
      let techData = { hasPixel: false, hasAds: false, instagram: null };
      
      // Se tiver site, tenta detectar se tem Pixel e redes sociais
      if (lead.website) {
        try {
          const sitePage = await browser.newPage();
          await sitePage.goto(lead.website, { waitUntil: 'domcontentloaded', timeout: 10000 });
          const content = await sitePage.content();
          
          techData.hasPixel = content.includes('fbevents.js') || content.includes('fbq(');
          techData.hasAds = content.includes('adsbygoogle') || content.includes('gtag(');
          techData.instagram = content.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)?.[0] || null;
          
          await sitePage.close();
        } catch (e) {
             console.log(`   ⚠️ Erro ao analisar site de ${lead.name}`);
        }
      }

      // Calcula Lead Scoring Avançado
      let score = 0;
      if (!lead.website) score += 40;
      else if (!techData.hasPixel) score += 20; // Tem site mas não faz anúncio
      
      if (lead.rating < 4.4) score += 25;
      if (lead.reviews < 30) score += 15;
      if (lead.phone) score += 10;

      const leadObj = {
        ...lead,
        score,
        has_pixel: techData.hasPixel,
        has_ads: techData.hasAds,
        instagram: techData.instagram,
        status: 'Pendente',
        lastUpdated: new Date().toISOString()
      };

      await supabase.from('leads').upsert(leadObj, { onConflict: 'name' });
      console.log(`   ✅ Lead processado: ${lead.name} [Score: ${score}]`);
    }

    console.log(`🏁 Missão Cumprida! Base de dados atualizada.`);
  } catch (err) {
    console.error('Erro crítico no robô:', err.message);
  }

  await browser.close();
}

module.exports = { scrapeGoogleMaps };
