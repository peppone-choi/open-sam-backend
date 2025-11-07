const fs = require('fs');
const glob = require('glob');

// applyDB(db) 패턴을 save()로 변경
const files = glob.sync('src/commands/**/*.ts');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  // general.applyDB(db) -> await general.save()
  if (content.includes('.applyDB(db)')) {
    content = content.replace(/(\w+)\.applyDB\(db\);/g, 'await $1.save();');
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed: ${file}`);
  }
});

console.log('Done!');
