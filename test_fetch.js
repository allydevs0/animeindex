const PROXY_URL = 'https://black-scene-6407.allydevs0.workers.dev/?url=';
async function fetchHtml(url) {
    const res = await fetch(PROXY_URL + encodeURIComponent(url));
    const text = await res.text();
    const locRegex = /<loc>(https:\/\/animesonlinecc\.to\/anime\/([^/]+)\/)<\/loc>/g;
    let match;
    let count = 0;
    while ((match = locRegex.exec(text)) !== null) {
      count++;
    }
    console.log('Matches:', count);
}
fetchHtml('https://animesonlinecc.to/tvshows-sitemap2.xml').catch(console.error);
