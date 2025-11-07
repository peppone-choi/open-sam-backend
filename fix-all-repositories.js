const fs = require('fs');
const path = require('path');

/**
 * Comprehensive repository fix script
 * Fixes all repository-related issues
 */

// List of repositories that need proper instance methods
const REPOSITORIES_TO_FIX = [
  {
    name: 'general-turn',
    model: 'GeneralTurn',
    modelPath: '../models/general_turn.model'
  },
  {
    name: 'nation-turn',
    model: 'NationTurn',
    modelPath: '../models/nation_turn.model'
  },
  {
    name: 'vote',
    model: 'Vote',
    modelPath: '../models/vote.model'
  }
];

function generateRepositoryClass(config) {
  const { name, model, modelPath } = config;
  const className = name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const instanceName = name.split('-').map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Repository';
  
  return `import { ${model} } from '${modelPath}';

/**
 * ${model} 리포지토리
 */
class ${className}Repository {
  /**
   * 조건으로 조회
   */
  async findByFilter(filter: any) {
    return (${model} as any).find(filter);
  }

  /**
   * 조건으로 한 개 조회
   */
  async findOneByFilter(filter: any) {
    return (${model} as any).findOne(filter);
  }

  /**
   * ID로 조회
   */
  async findById(id: string) {
    return (${model} as any).findById(id);
  }

  /**
   * 생성
   */
  async create(data: any) {
    return (${model} as any).create(data);
  }

  /**
   * 업데이트
   */
  async updateOne(filter: any, update: any) {
    return (${model} as any).updateOne(filter, update);
  }

  /**
   * 여러 개 업데이트
   */
  async updateMany(filter: any, update: any) {
    return (${model} as any).updateMany(filter, update);
  }

  /**
   * 업데이트 또는 생성 (upsert)
   */
  async findOneAndUpdate(filter: any, update: any, options?: any) {
    return (${model} as any).findOneAndUpdate(filter, update, options);
  }

  /**
   * 삭제
   */
  async deleteOne(filter: any) {
    return (${model} as any).deleteOne(filter);
  }

  /**
   * 여러 개 삭제
   */
  async deleteMany(filter: any) {
    return (${model} as any).deleteMany(filter);
  }

  /**
   * 개수 세기
   */
  async count(filter: any): Promise<number> {
    return (${model} as any).countDocuments(filter);
  }

  /**
   * 벌크 작업
   */
  async bulkWrite(operations: any[]) {
    return (${model} as any).bulkWrite(operations);
  }
}

/**
 * ${model} 리포지토리 싱글톤
 */
export const ${instanceName} = new ${className}Repository();
`;
}

// Generate repositories
REPOSITORIES_TO_FIX.forEach(config => {
  const fileName = `src/repositories/${config.name}.repository.ts`;
  const content = generateRepositoryClass(config);
  
  // Backup existing file
  if (fs.existsSync(fileName)) {
    fs.copyFileSync(fileName, `${fileName}.backup2`);
  }
  
  fs.writeFileSync(fileName, content);
  console.log(`✅ Generated ${fileName}`);
});

// Fix static repositories (inheritaction, nationcommand)
const STATIC_REPOS = [
  { file: 'src/repositories/inheritaction.repository.ts', name: 'InheritactionRepository', instance: 'inheritactionRepository' },
  { file: 'src/repositories/nationcommand.repository.ts', name: 'NationcommandRepository', instance: 'nationcommandRepository' }
];

STATIC_REPOS.forEach(({ file, name, instance }) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix the class name in the export line
    content = content.replace(
      new RegExp(`export const ${instance} = new .*Repository\\(\\);`, 'g'),
      `export const ${instance} = new ${name}();`
    );
    
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed ${file}`);
  }
});

console.log('\n✨ All repositories fixed!');
