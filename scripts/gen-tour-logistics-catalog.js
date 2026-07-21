const fs = require('fs');
const t = fs.readFileSync('js/state.js', 'utf8');
const re = /^\s+(fly|car|boat|stay)\(([^;]+)\);/gm;
const lines = [];
let m;
while ((m = re.exec(t))) {
  lines.push('  ' + m[1] + '(' + m[2] + ');');
}
const body = lines.join('\n');
const out =
  '/* Tour logistics catalog — keep in sync with seed() in state.js */\n' +
  'function runTourLogisticsLines(row){\n' +
  "  const fly=(d,t,s,e)=>row('travel',d,t,s,e,'plane');\n" +
  "  const car=(d,t,s,e)=>row('travel',d,t,s,e,'car');\n" +
  "  const boat=(d,t,s,e)=>row('travel',d,t,s,e,'ferry');\n" +
  "  const stay=(d,t,info)=>row('stay',d,t,'','','bed',info);\n" +
  body + '\n}\n' +
  'function buildTourLogisticsCatalog(){\n' +
  '  const cat=[];\n' +
  "  runTourLogisticsLines((kind,date,title,start,end,icon,info)=>cat.push({kind,date,title,start,end,icon,info:info||''}));\n" +
  '  return cat;\n' +
  '}\n';
fs.writeFileSync('js/tour-logistics-catalog.js', out);
console.log('wrote', lines.length, 'entries');
