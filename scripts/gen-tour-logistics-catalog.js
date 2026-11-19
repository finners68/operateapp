const fs = require('fs');
const out =
  '/* Logistics title recovery catalog (empty — no bundled demo data). */\n' +
  'function runTourLogisticsLines(row){}\n' +
  'function buildTourLogisticsCatalog(){\n' +
  '  return [];\n' +
  '}\n';
fs.writeFileSync('js/tour-logistics-catalog.js', out);
console.log('wrote empty tour-logistics-catalog.js');
