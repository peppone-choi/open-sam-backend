import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ITEMS_DIR = path.join(__dirname, '../sam/hwe/sammo/ActionItem');
const OUTPUT_FILE = path.join(__dirname, '../config/scenarios/sangokushi/data/items.json');

async function extractItemMetadata(filePath, filename) {
  const content = await fs.readFile(filePath, 'utf-8');
  
  if (filename === 'None.php') {
    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'None';
    const costMatch = content.match(/protected\s+\$cost\s*=\s*(\d+)/);
    const consumableMatch = content.match(/protected\s+\$consumable\s*=\s*(true|false)/);
    const buyableMatch = content.match(/protected\s+\$buyable\s*=\s*(true|false)/);
    const nameMatch = content.match(/protected\s+\$name\s*=\s*'([^']+)'/);
    const infoMatch = content.match(/protected\s+\$info\s*=\s*'([^']+)'/);
    const extendsMatch = content.match(/extends\s+\\sammo\\(\w+)/);
    
    return {
      id: className,
      name: nameMatch ? nameMatch[1] : 'None',
      category: 'system',
      cost: costMatch ? parseInt(costMatch[1]) : 0,
      consumable: consumableMatch ? consumableMatch[1] === 'true' : false,
      buyable: buyableMatch ? buyableMatch[1] === 'true' : false,
      description: infoMatch ? infoMatch[1] : null,
      baseClass: extendsMatch ? extendsMatch[1] : null,
      filename: filename
    };
  }
  
  const match = filename.match(/^(che|event)_(.+?)(?:_(.+))?\.php$/);
  if (!match) return null;

  const prefix = match[1];
  const category = match[2];
  const itemName = match[3] || category;
  
  const classMatch = content.match(/class\s+(che_\S+|event_\S+)/);
  const className = classMatch ? classMatch[1] : filename.replace('.php', '');
  
  const costMatch = content.match(/protected\s+\$cost\s*=\s*(\d+)/);
  const consumableMatch = content.match(/protected\s+\$consumable\s*=\s*(true|false)/);
  const buyableMatch = content.match(/protected\s+\$buyable\s*=\s*(true|false)/);
  const rawNameMatch = content.match(/protected\s+\$rawName\s*=\s*'([^']+)'/);
  const nameMatch = content.match(/protected\s+\$name\s*=\s*'([^']+)'/);
  const infoMatch = content.match(/protected\s+\$info\s*=\s*'([^']+)'/);
  const extendsMatch = content.match(/extends\s+\\sammo\\(\w+)/);
  
  return {
    id: className,
    name: nameMatch ? nameMatch[1] : (rawNameMatch ? rawNameMatch[1] : itemName),
    category: category,
    cost: costMatch ? parseInt(costMatch[1]) : null,
    consumable: consumableMatch ? consumableMatch[1] === 'true' : null,
    buyable: buyableMatch ? buyableMatch[1] === 'true' : null,
    description: infoMatch ? infoMatch[1] : null,
    baseClass: extendsMatch ? extendsMatch[1] : null,
    filename: filename
  };
}

async function main() {
  const files = await fs.readdir(ITEMS_DIR);
  const phpFiles = files.filter(f => f.endsWith('.php'));
  
  console.log(`Found ${phpFiles.length} PHP files`);
  
  const items = [];
  for (const file of phpFiles) {
    const filePath = path.join(ITEMS_DIR, file);
    const metadata = await extractItemMetadata(filePath, file);
    if (metadata) {
      items.push(metadata);
    }
  }
  
  const categorized = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});
  
  for (const category in categorized) {
    categorized[category].sort((a, b) => a.id.localeCompare(b.id));
  }
  
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify({
      totalItems: items.length,
      categories: Object.keys(categorized).sort(),
      categoryCount: Object.keys(categorized).length,
      items: categorized
    }, null, 2),
    'utf-8'
  );
  
  console.log(`Extracted ${items.length} items into ${Object.keys(categorized).length} categories`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('\nCategories:', Object.keys(categorized).sort().join(', '));
}

main().catch(console.error);
