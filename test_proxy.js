const PROXY_URL = 'https://black-scene-6407.allydevs0.workers.dev/?url=';
async function run() {
  console.log("Testing proxy fetch...");
  try {
    const res = await fetch(PROXY_URL + encodeURIComponent('https://animesonlinecc.to/tvshows-sitemap2.xml'));
    console.log("Proxy Status:", res.status);
    const text = await res.text();
    console.log("Proxy Length:", text.length);
  } catch(e) {
    console.error("Proxy error:", e.message);
  }
}
run();
