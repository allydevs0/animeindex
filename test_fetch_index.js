const PROXY_URL = 'https://black-scene-6407.allydevs0.workers.dev/?url=';
async function fetchHtml(url) {
    const res = await fetch(PROXY_URL + encodeURIComponent(url));
    const text = await res.text();
    console.log(text.substring(0, 1000)); // just see what sitemaps exist
}
fetchHtml('https://animesonlinecc.to/sitemap_index.xml').catch(console.error);
