/**
 * 범용 게임 엔진 - ActionSystem
 * 액션 실행 및 검증 시스템
 */

import { Entity } from './Entity';
import { World, ActionDefinition, ActionConstraint, ActionEffect } from './World';
import { FormulaParser, FormulaContext } from './FormulaParser';

export interface ActionExecutionContext {
  entity: Entity;
  location?: Record<string, any>; // 도시, 위치 등의 데이터
  env?: Record<string, any>; // 환경 변수 (develcost, year 등)
  target?: Entity; // 대상 엔티티 (전투, 거래 등)
}

export interface ActionExecutionResult {
  success: boolean;
  message?: string;
  changes?: {
    stats?: Record<string, number>;
    resources?: Record<string, number>;
    location?: Record<string, any>;
    experience?: Record<string, number>;
  };
}

/**
 * ActionSystem 클래스
 * 액션 실행 및 검증 로직
 */
export class ActionSystem {
  constructor(private world: World) {}

  /**
   * 액션 실행 가능 여부 검증
   */
  canExecute(actionId: string, context: ActionExecutionContext): ActionExecutionResult {
    const actionDef = this.world.getActionDefinition(actionId);
    if (!actionDef) {
      return {
        success: false,
        message: `Unknown action: ${actionId}`
      };
    }

    // 제약 조건 검증
    const constraintCheck = this.checkConstraints(actionDef, context);
    if (!constraintCheck.success) {
      return constraintCheck;
    }

    // 비용 검증
    const costCheck = this.checkCosts(actionDef, context);
    if (!costCheck.success) {
      return costCheck;
    }

    return { success: true };
  }

  /**
   * 액션 실행
   */
  execute(actionId: string, context: ActionExecutionContext): ActionExecutionResult {
    // 실행 가능 여부 검증
    const canExecute = this.canExecute(actionId, context);
    if (!canExecute.success) {
      return canExecute;
    }

    const actionDef = this.world.getActionDefinition(actionId);
    if (!actionDef) {
      return {
        success: false,
        message: `Unknown action: ${actionId}`
      };
    }

    const result: ActionExecutionResult = {
      success: true,
      changes: {}
    };

    // 비용 차감
    const costs = this.applyCosts(actionDef, context);
    if (costs) {
      result.changes!.resources = costs;
    }

    // 효과 적용
    const effects = this.applyEffects(actionDef, context);
    if (effects) {
      result.changes = { ...result.changes, ...effects };
    }

    // 경험치 적용
    const experience = this.applyExperience(actionDef, context);
    if (experience) {
      result.changes!.experience = experience;
    }

    return result;
  }

  /**
   * 제약 조건 검증
   */
  private checkConstraints(
    actionDef: ActionDefinition,
    context: ActionExecutionContext
  ): ActionExecutionResult {
    if (!actionDef.constraints || actionDef.constraints.length === 0) {
      return { success: true };
    }

    const formulaContext = this.buildFormulaContext(context);

    for (const constraint of actionDef.constraints) {
      const checkResult = this.evaluateConstraint(constraint, formulaContext, context);
      if (!checkResult.success) {
        return checkResult;
      }
    }

    return { success: true };
  }

  /**
   * 개별 제약 조건 평가
   */
  private evaluateConstraint(
    constraint: ActionConstraint,
    formulaContext: FormulaContext,
    context: ActionExecutionContext
  ): ActionExecutionResult {
    const { type, operator, value, message } = constraint;

    let actualValue: number;

    if (type === 'resource') {
      const resourceId = constraint.resource || constraint.target || '';
      actualValue = context.entity.getResource(resourceId);
    } else if (type === 'stat') {
      const statId = constraint.target || '';
      actualValue = context.entity.getStat(statId);
    } else {
      // custom type은 향후 확장
      return { success: true };
    }

    const requiredValue = typeof value === 'number' ? value : FormulaParser.evaluate(value, formulaContext);

    const passed = this.evaluateOperator(actualValue, operator, requiredValue);

    if (!passed) {
      return {
        success: false,
        message: message || '조건을 만족하지 않습니다.'
      };
    }

    return { success: true };
  }

  /**
   * 연산자 평가
   */
  private evaluateOperator(left: number, operator: string, right: number): boolean {
    switch (operator) {
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '==':
      case '===':
        return left === right;
      case '!=':
      case '!==':
        return left !== right;
      default:
        return false;
    }
  }

  /**
   * 비용 검증
   */
  private checkCosts(
    actionDef: ActionDefinition,
    context: ActionExecutionContext
  ): ActionExecutionResult {
    if (!actionDef.costs) {
      return { success: true };
    }

    const formulaContext = this.buildFormulaContext(context);
    const costs = FormulaParser.evaluateCosts(actionDef.costs, formulaContext);

    for (const [resourceId, amount] of Object.entries(costs)) {
      const current = context.entity.getResource(resourceId);
      if (current < amount) {
        return {
          success: false,
          message: `${resourceId} 부족: ${current}/${amount}`
        };
      }
    }

    return { success: true };
  }

  /**
   * 비용 차감
   */
  private applyCosts(
    actionDef: ActionDefinition,
    context: ActionExecutionContext
  ): Record<string, number> | undefined {
    if (!actionDef.costs) {
      return undefined;
    }

    const formulaContext = this.buildFormulaContext(context);
    const costs = FormulaParser.evaluateCosts(actionDef.costs, formulaContext);

    const changes: Record<string, number> = {};

    for (const [resourceId, amount] of Object.entries(costs)) {
      const newValue = context.entity.modifyResource(resourceId, -amount);
      changes[resourceId] = newValue;
    }

    return changes;
  }

  /**
   * 효과 적용
   */
  private applyEffects(
    actionDef: ActionDefinition,
    context: ActionExecutionContext
  ): any {
    if (!actionDef.effects || actionDef.effects.length === 0) {
      return undefined;
    }

    const formulaContext = this.buildFormulaContext(context);
    const changes: any = {};

    for (const effect of actionDef.effects) {
      const effectChanges = this.applyEffect(effect, formulaContext, context);
      Object.assign(changes, effectChanges);
    }

    return changes;
  }

  /**
   * 개별 효과 적용
   */
  private applyEffect(
    effect: ActionEffect,
    formulaContext: FormulaContext,
    context: ActionExecutionContext
  ): any {
    const { target, formula, type = 'add' } = effect;
    const value = FormulaParser.evaluate(formula, formulaContext);

    // target 파싱 (예: "stats.leadership", "resource.gold", "location.comm")
    const [targetType, targetId] = target.split('.');

    const changes: any = {};

    switch (targetType) {
      case 'stats':
      case 'stat':
        if (type === 'add') {
          const newValue = context.entity.modifyStat(targetId, value);
          changes.stats = changes.stats || {};
          changes.stats[targetId] = newValue;
        } else if (type === 'set') {
          context.entity.setStat(targetId, value);
          changes.stats = changes.stats || {};
          changes.stats[targetId] = value;
        }
        break;

      case 'resources':
      case 'resource':
        if (type === 'add') {
          const newValue = context.entity.modifyResource(targetId, value);
          changes.resources = changes.resources || {};
          changes.resources[targetId] = newValue;
        } else if (type === 'set') {
          context.entity.setResource(targetId, value);
          changes.resources = changes.resources || {};
          changes.resources[targetId] = value;
        }
        break;

      case 'location':
        if (context.location && targetId) {
          if (type === 'add') {
            context.location[targetId] = (context.location[targetId] || 0) + value;
          } else if (type === 'set') {
            context.location[targetId] = value;
          }
          changes.location = changes.location || {};
          changes.location[targetId] = context.location[targetId];
        }
        break;

      default:
        console.warn(`Unknown target type: ${targetType}`);
    }

    return changes;
  }

  /**
   * 경험치 적용
   */
  private applyExperience(
    actionDef: ActionDefinition,
    context: ActionExecutionContext
  ): Record<string, number> | undefined {
    if (!actionDef.experience) {
      return undefined;
    }

    const formulaContext = this.buildFormulaContext(context);
    const experience = FormulaParser.evaluateExperience(actionDef.experience, formulaContext);

    for (const [statId, expValue] of Object.entries(experience)) {
      context.entity.modifyStat(statId, expValue);
    }

    return experience;
  }

  /**
   * FormulaContext 구성
   */
  private buildFormulaContext(context: ActionExecutionContext): FormulaContext {
    return {
      entity: context.entity,
      stats: context.entity.getAllStats(),
      resources: context.entity.getAllResources(),
      location: context.location,
      env: context.env
    };
  }
}
