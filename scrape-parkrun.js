const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_URL = 'https://images.parkrun.com/events.json';
const DATA_FILE = path.join(__dirname, 'public', 'events-data.json');
const ONE_HOUR = 60 * 60 * 1000;

function fileIsFresh(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const now = Date.now();
    return now - stats.mtimeMs < ONE_HOUR;
  } catch (err) {
    return false;
  }
}

function fetchAndSaveJSON(url, filePath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Failed to fetch data: ' + res.statusCode));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fs.writeFileSync(filePath, data);
        console.log(`Saved events data to ${filePath}`);
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  if (fileIsFresh(DATA_FILE)) {
    console.log('Events data is fresh (<1h old), not scraping.');
    return;
  }
  await fetchAndSaveJSON(DATA_URL, DATA_FILE);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
