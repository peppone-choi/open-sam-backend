const fs = require('fs');
const path = require('path');

/**
 * Repository migration script
 * Converts (Model as any).method() to repository.method()
 */

// Model to Repository mapping
const MODEL_TO_REPO = {
  'General': 'generalRepository',
  'Nation': 'nationRepository',
  'City': 'cityRepository',
  'Session': 'sessionRepository',
  'Message': 'messageRepository',
  'Auction': 'auctionRepository',
  'Battle': 'battleRepository',
  'Troop': 'troopRepository',
  'Diplomacy': 'diplomacyRepository',
  'Vote': 'voteRepository',
  'Command': 'commandRepository',
  'GeneralTurn': 'generalTurnRepository',
  'GeneralRecord': 'generalRecordRepository',
  'NationTurn': 'nationTurnRepository',
  'WorldHistory': 'worldHistoryRepository',
  'NgDiplomacy': 'ngDiplomacyRepository',
  'Betting': 'bettingRepository',
  'GlobalData': 'globalRepository',
  'Inheritaction': 'inheritactionRepository',
  'NationCommand': 'nationcommandRepository',
  'Misc': 'miscRepository',
  'KVStorage': 'kvStorageRepository',
  'Tournament': 'tournamentRepository',
  'BattleMapTemplate': 'battleMapTemplateRepository',
};

// Repository import paths
const REPO_IMPORTS = {
  'generalRepository': "import { generalRepository } from '../../repositories/general.repository';",
  'nationRepository': "import { nationRepository } from '../../repositories/nation.repository';",
  'cityRepository': "import { cityRepository } from '../../repositories/city.repository';",
  'sessionRepository': "import { sessionRepository } from '../../repositories/session.repository';",
  'messageRepository': "import { messageRepository } from '../../repositories/message.repository';",
  'auctionRepository': "import { auctionRepository } from '../../repositories/auction.repository';",
  'battleRepository': "import { battleRepository } from '../../repositories/battle.repository';",
  'troopRepository': "import { troopRepository } from '../../repositories/troop.repository';",
  'diplomacyRepository': "import { diplomacyRepository } from '../../repositories/diplomacy.repository';",
  'voteRepository': "import { voteRepository } from '../../repositories/vote.repository';",
  'commandRepository': "import { commandRepository } from '../../repositories/command.repository';",
  'generalTurnRepository': "import { generalTurnRepository } from '../../repositories/general-turn.repository';",
  'generalRecordRepository': "import { generalRecordRepository } from '../../repositories/general-record.repository';",
  'nationTurnRepository': "import { nationTurnRepository } from '../../repositories/nation-turn.repository';",
  'worldHistoryRepository': "import { worldHistoryRepository } from '../../repositories/world-history.repository';",
  'ngDiplomacyRepository': "import { ngDiplomacyRepository } from '../../repositories/ng-diplomacy.repository';",
  'bettingRepository': "import { bettingRepository } from '../../repositories/betting.repository';",
  'globalRepository': "import { globalRepository } from '../../repositories/global.repository';",
  'inheritactionRepository': "import { inheritactionRepository } from '../../repositories/inheritaction.repository';",
  'nationcommandRepository': "import { nationcommandRepository } from '../../repositories/nationcommand.repository';",
  'miscRepository': "import { miscRepository } from '../../repositories/misc.repository';",
  'kvStorageRepository': "import { kvStorageRepository } from '../../repositories/kvstorage.repository';",
  'tournamentRepository': "import { tournamentRepository } from '../../repositories/tournament.repository';",
  'battleMapTemplateRepository': "import { battleMapTemplateRepository } from '../../repositories/battle-map-template.repository';",
};

// Method conversions
const METHOD_CONVERSIONS = {
  'findOne': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    if (!repo) return null;
    
    // Try to determine the specific method based on filter
    if (model === 'General') {
      if (args.includes('session_id') && args.includes("'data.no'")) {
        return `${repo}.findBySessionAndNo`;
      }
      if (args.includes('owner')) {
        return `${repo}.findBySessionAndOwner`;
      }
      if (args.includes('_id')) {
        return `${repo}.findById`;
      }
    }
    
    return `${repo}.findOneByFilter`;
  },
  'find': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    if (!repo) return null;
    
    if (model === 'General') {
      if (args.includes('session_id') && args.includes('nation:')) {
        return `${repo}.findByNation`;
      }
      if (args.includes('session_id') && args.includes('city:')) {
        return `${repo}.findByCity`;
      }
      if (args.includes('session_id') && !args.includes('nation') && !args.includes('city')) {
        return `${repo}.findBySession`;
      }
    }
    
    return `${repo}.findByFilter`;
  },
  'findById': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.findById` : null;
  },
  'updateMany': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.updateManyByFilter` : null;
  },
  'updateOne': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.updateOneByFilter` : null;
  },
  'deleteOne': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.deleteByFilter` : null;
  },
  'deleteMany': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.deleteManyByFilter` : null;
  },
  'countDocuments': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.count` : null;
  },
  'create': (model, args) => {
    const repo = MODEL_TO_REPO[model];
    return repo ? `${repo}.create` : null;
  },
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const neededRepos = new Set();
  
  // Find all (Model as any).method() patterns
  const pattern = /\((\w+)\s+as\s+any\)\.(findOne|find|findById|updateMany|updateOne|deleteOne|deleteMany|countDocuments|create)/g;
  
  let match;
  const replacements = [];
  
  while ((match = pattern.exec(content)) !== null) {
    const [fullMatch, modelName, method] = match;
    const repo = MODEL_TO_REPO[modelName];
    
    if (repo) {
      // Extract the arguments (rough extraction)
      const startPos = match.index + fullMatch.length;
      const argsStart = content.indexOf('(', startPos);
      if (argsStart !== -1) {
        let depth = 1;
        let argsEnd = argsStart + 1;
        while (depth > 0 && argsEnd < content.length) {
          if (content[argsEnd] === '(') depth++;
          if (content[argsEnd] === ')') depth--;
          argsEnd++;
        }
        const args = content.substring(argsStart, argsEnd);
        
        // Determine the correct repository method
        const converter = METHOD_CONVERSIONS[method];
        if (converter) {
          const repoMethod = converter(modelName, args);
          if (repoMethod) {
            replacements.push({
              start: match.index,
              end: startPos,
              original: fullMatch,
              replacement: repoMethod
            });
            neededRepos.add(repo);
            modified = true;
          }
        }
      }
    }
  }
  
  // Apply replacements in reverse order (to maintain positions)
  replacements.reverse().forEach(({ start, end, replacement }) => {
    content = content.substring(0, start) + replacement + content.substring(end);
  });
  
  // Add repository imports if needed
  if (neededRepos.size > 0) {
    // Find existing imports
    const importRegion = content.substring(0, Math.min(1000, content.length));
    const lastImportIndex = importRegion.lastIndexOf('import ');
    
    if (lastImportIndex !== -1) {
      const endOfLastImport = content.indexOf('\n', lastImportIndex) + 1;
      const newImports = Array.from(neededRepos)
        .filter(repo => !content.includes(`import { ${repo} }`))
        .map(repo => REPO_IMPORTS[repo])
        .filter(Boolean)
        .join('\n');
      
      if (newImports) {
        content = content.substring(0, endOfLastImport) + newImports + '\n' + content.substring(endOfLastImport);
      }
    }
  }
  
  // Remove .lean() chains since repositories already return plain objects
  content = content.replace(/\.lean\(\)/g, '');
  
  // Remove .select() chains (need manual review for specific fields)
  // content = content.replace(/\.select\([^)]*\)/g, '');
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.relative(process.cwd(), filePath)} - Fixed ${replacements.length} occurrences`);
    return replacements.length;
  }
  
  return 0;
}

function processDirectory(dir) {
  let totalFixed = 0;
  let filesFixed = 0;
  
  function walk(directory) {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        const fixed = processFile(filePath);
        if (fixed > 0) {
          totalFixed += fixed;
          filesFixed++;
        }
      }
    }
  }
  
  walk(dir);
  return { totalFixed, filesFixed };
}

// Main execution
const servicesDir = path.join(__dirname, 'src', 'services');
console.log('🚀 Starting repository migration...\n');

const { totalFixed, filesFixed } = processDirectory(servicesDir);

console.log(`\n✨ Migration complete!`);
console.log(`📝 Files modified: ${filesFixed}`);
console.log(`🔧 Total occurrences fixed: ${totalFixed}`);
console.log(`\n⚠️  Manual review needed for:`);
console.log(`   - .select() chains (commented out)`);
console.log(`   - Complex queries that may need custom repository methods`);
console.log(`   - Models without repositories (KVStorage, Tournament, etc.)`);
