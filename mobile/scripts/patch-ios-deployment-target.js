const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'ios', 'Podfile.properties.json');
if (!fs.existsSync(p)) {
  console.log('[patch-ios-deployment-target] ios/Podfile.properties.json not found (did prebuild run?)');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(p, 'utf8'));
data['ios.deploymentTarget'] = '15.5';
fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
console.log('[patch-ios-deployment-target] set ios.deploymentTarget=15.5 in', p);
