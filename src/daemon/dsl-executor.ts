/**
 * DSL 실행 엔진
 * 
 * AST로부터 변환된 DSL을 실행
 */

export async function executeDSL(logic: any[], context: {
  general: any;
  city: any;
  nation: any;
  arg: any;
}) {
  for (const cmd of logic) {
    await executeCommand(cmd, context);
  }
}

async function executeCommand(cmd: any, context: any) {
  const { general, city, nation } = context;
  
  switch (cmd.type) {
    case 'increase':
      // { type: 'increase', entity: 'general', field: 'crew', amount: 100 }
      const target = context[cmd.entity];
      if (target && target.data) {
        const amount = evaluateAmount(cmd.amount, context);
        target.data[cmd.field] = (target.data[cmd.field] || 0) + amount;
        await target.save();
      }
      break;
      
    case 'set':
      // { type: 'set', entity: 'general', field: 'train', value: 50 }
      const setTarget = context[cmd.entity];
      if (setTarget && setTarget.data) {
        const value = evaluateAmount(cmd.value, context);
        setTarget.data[cmd.field] = value;
        await setTarget.save();
      }
      break;
      
    case 'update_multiple':
      // { type: 'update_multiple', entity: 'city', fields: { pop: -1000 } }
      const updateTarget = context[cmd.entity];
      if (updateTarget && updateTarget.data && cmd.fields) {
        for (const [field, value] of Object.entries(cmd.fields)) {
          const evaluated = evaluateAmount(value, context);
          updateTarget.data[field] = evaluated;
        }
        await updateTarget.save();
      }
      break;
  }
}

function evaluateAmount(amount: any, context: any): number {
  if (typeof amount === 'number') {
    return amount;
  }
  
  if (typeof amount === 'string') {
    // "{{arg.amount}}" → context.arg.amount
    if (amount.includes('{{')) {
      const match = amount.match(/\{\{(.+?)\}\}/);
      if (match) {
        const expr = match[1];
        // arg.amount
        if (expr.startsWith('arg.')) {
          return context.arg[expr.substring(4)] || 0;
        }
        // calculated
        if (expr === 'calculated') {
          return 0;
        }
      }
    }
    
    // "100"
    if (!isNaN(parseFloat(amount))) {
      return parseFloat(amount);
    }
  }
  
  return 0;
}
