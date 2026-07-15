

fetch('https://animefire.plus/animes/hanaori-san-wa-tensei-shitemo-kenka-ga-shitai-todos-os-episodios')
  .then(r => r.text())
  .then(html => {
    const fs = require('fs');
    fs.writeFileSync('af-html-2.txt', html);
    
    // Test the global regex
    const globalRegex = /href="https?:\/\/animefire\.[a-z]+\/genero\/([^"]+)"[^>]*>(.*?)<\/a>/gi;
    let match;
    const globalMatches = [];
    while ((match = globalRegex.exec(html)) !== null) {
      globalMatches.push(match[2]);
    }
    console.log('Global Matches:', globalMatches.length);
    
    // Now let's try to isolate the section
    const infoSection = html.match(/<div class="animeInfo[^>]*>([\s\S]*?)<\/div>/i);
    if(infoSection) {
      const sectionHtml = infoSection[1];
      const localMatches = [];
      const localRegex = /href="https?:\/\/animefire\.[a-z]+\/genero\/([^"]+)"[^>]*>(.*?)<\/a>/gi;
      while ((match = localRegex.exec(sectionHtml)) !== null) {
        localMatches.push(match[2]);
      }
      console.log('Local Matches:', localMatches);
    } else {
      // Find where genres actually are
      const genresDiv = html.match(/<div class="genres"[^>]*>([\s\S]*?)<\/div>/i);
      console.log('Genres Div:', genresDiv ? genresDiv[1] : 'Not found');
    }
  });
