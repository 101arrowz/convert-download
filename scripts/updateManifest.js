const { join } = require('path');
const { readFileSync, writeFileSync } = require('fs');
const extManifest = join(__dirname, '..', 'src', 'manifest.json');
writeFileSync(extManifest, JSON.stringify({ ...JSON.parse(readFileSync(extManifest)), ...JSON.parse(process.argv[2]) }, null, 2));