import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { gin7CommandCatalog } from '../src/config/gin7/catalog';

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  validateAgainstSchema(errors);

  const commandCodes = new Set(Object.keys(gin7CommandCatalog.commands));
  const templateIds = new Set<string>();
  const shortcutKeys = new Set<string>();

  gin7CommandCatalog.authorityCards.forEach((card) => {
    if (templateIds.has(card.templateId)) {
      errors.push(`중복된 카드 templateId 감지: ${card.templateId}`);
    }
    templateIds.add(card.templateId);

    if (!card.commandGroups.length) {
      errors.push(`카드 ${card.templateId} 에 commandGroups 가 비어 있습니다.`);
    }
    if (!card.commandCodes.length) {
      warnings.push(`카드 ${card.templateId} 에 commandCodes 가 비어 있습니다.`);
    }

    if (!card.factionScope?.length) {
      errors.push(`카드 ${card.templateId} 는 factionScope 가 필요합니다.`);
    }

    card.commandCodes.forEach((code) => {
      if (!commandCodes.has(code)) {
        errors.push(`카드 ${card.templateId} 가 정의되지 않은 커맨드 ${code} 를 참조합니다.`);
      }
    });
  });

  gin7CommandCatalog.shortcuts.forEach((shortcut, index) => {
    const keyId = `${shortcut.key}:${shortcut.commandCode ?? index}`;
    if (shortcutKeys.has(keyId)) {
      warnings.push(`단축키 ${keyId} 가 중복으로 정의되었습니다.`);
    }
    shortcutKeys.add(keyId);
    if (shortcut.commandCode && !commandCodes.has(shortcut.commandCode)) {
      errors.push(`단축키 ${shortcut.key} 가 존재하지 않는 커맨드 ${shortcut.commandCode} 를 가리킵니다.`);
    }
  });

  Object.values(gin7CommandCatalog.commands).forEach((command) => {
    if (!command.manualRef) {
      warnings.push(`커맨드 ${command.code} 는 manualRef 가 비어 있습니다.`);
    }
    if (!command.cpType && command.cpCost !== undefined) {
      warnings.push(`커맨드 ${command.code} 는 cpCost 가 있지만 cpType 이 없습니다.`);
    }
  });

  if (errors.length) {
    errors.forEach((err) => console.error(`[GIN7][ERROR] ${err}`));
    warnings.forEach((warn) => console.warn(`[GIN7][WARN] ${warn}`));
    process.exit(1);
  }

  warnings.forEach((warn) => console.warn(`[GIN7][WARN] ${warn}`));
  console.log(
    `[GIN7] 커맨드/카드 카탈로그 검증 완료 - cards: ${gin7CommandCatalog.authorityCards.length}, commands: ${commandCodes.size}, shortcuts: ${gin7CommandCatalog.shortcuts.length}`
  );
}

function validateAgainstSchema(errors: string[]) {
  const schemaPath = path.join(__dirname, '../config/gin7/catalog.schema.json');
  const schemaRaw = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaRaw);
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(gin7CommandCatalog);
  if (!valid && validate.errors?.length) {
    validate.errors.forEach((issue) => {
      const instancePath = issue.instancePath || '(root)';
      errors.push(`스키마 위반 ${instancePath}: ${issue.message}`);
    });
  }
}

main();
