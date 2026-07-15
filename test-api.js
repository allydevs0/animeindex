(async () => {
  try {
    const ad = await fetch('https://animesdigital.org/animes', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    console.log('AnimesDigital /animes:', ad.status);
    const txt = await ad.text();
    const matches = txt.match(/href="https:\/\/animesdigital\.org\/anime\/[^"]+"/g);
    console.log('AnimesDigital /animes count:', matches ? matches.length : 0);
  } catch(e) { console.error('AD Error:', e.message); }
})();
