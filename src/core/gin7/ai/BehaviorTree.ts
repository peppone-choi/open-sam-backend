/**
 * Behavior Tree Framework for NPC AI
 * 
 * Behavior Tree는 게임 AI의 결정을 트리 구조로 표현합니다.
 * - Composite 노드: 자식 노드들을 관리 (Selector, Sequence, Parallel)
 * - Decorator 노드: 자식 노드의 결과를 변형 (Inverter, Repeater)
 * - Leaf 노드: 실제 조건 체크 또는 행동 수행 (Condition, Action)
 */

import { 
  BehaviorStatus, 
  BehaviorNodeType,
  AIBlackboard 
} from '../../../types/gin7/npc-ai.types';
import { logger } from '../../../common/logger';

// ============================================================
// Base BehaviorNode
// ============================================================

export abstract class BehaviorNode {
  readonly id: string;
  readonly type: BehaviorNodeType;
  protected name: string;
  protected parent: BehaviorNode | null = null;
  protected children: BehaviorNode[] = [];
  
  constructor(id: string, type: BehaviorNodeType, name: string = '') {
    this.id = id;
    this.type = type;
    this.name = name || id;
  }
  
  /**
   * 노드 실행 - 모든 서브클래스에서 구현 필요
   */
  abstract tick(blackboard: AIBlackboard): BehaviorStatus;
  
  /**
   * 노드 리셋 (RUNNING 상태 초기화)
   */
  reset(): void {
    for (const child of this.children) {
      child.reset();
    }
  }
  
  /**
   * 자식 노드 추가
   */
  addChild(child: BehaviorNode): this {
    child.parent = this;
    this.children.push(child);
    return this;
  }
  
  /**
   * 자식 노드들 설정
   */
  setChildren(children: BehaviorNode[]): this {
    this.children = [];
    for (const child of children) {
      this.addChild(child);
    }
    return this;
  }
  
  getName(): string {
    return this.name;
  }
  
  getChildren(): readonly BehaviorNode[] {
    return this.children;
  }
  
  /**
   * 디버그용 트리 출력
   */
  toString(indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    let result = `${prefix}[${this.type}] ${this.name} (${this.id})\n`;
    for (const child of this.children) {
      result += child.toString(indent + 1);
    }
    return result;
  }
}

// ============================================================
// Composite Nodes
// ============================================================

/**
 * Selector (OR 노드)
 * 자식 노드를 순서대로 실행하며, 하나라도 SUCCESS면 SUCCESS 반환
 * 모두 FAILURE면 FAILURE 반환
 */
export class SelectorNode extends BehaviorNode {
  private runningChildIndex: number = 0;
  
  constructor(id: string, name: string = 'Selector') {
    super(id, 'SELECTOR', name);
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    for (let i = this.runningChildIndex; i < this.children.length; i++) {
      const child = this.children[i];
      const status = child.tick(blackboard);
      
      if (status === BehaviorStatus.RUNNING) {
        this.runningChildIndex = i;
        return BehaviorStatus.RUNNING;
      }
      
      if (status === BehaviorStatus.SUCCESS) {
        this.runningChildIndex = 0;
        return BehaviorStatus.SUCCESS;
      }
    }
    
    this.runningChildIndex = 0;
    return BehaviorStatus.FAILURE;
  }
  
  reset(): void {
    this.runningChildIndex = 0;
    super.reset();
  }
}

/**
 * Sequence (AND 노드)
 * 자식 노드를 순서대로 실행하며, 모두 SUCCESS여야 SUCCESS 반환
 * 하나라도 FAILURE면 FAILURE 반환
 */
export class SequenceNode extends BehaviorNode {
  private runningChildIndex: number = 0;
  
  constructor(id: string, name: string = 'Sequence') {
    super(id, 'SEQUENCE', name);
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    for (let i = this.runningChildIndex; i < this.children.length; i++) {
      const child = this.children[i];
      const status = child.tick(blackboard);
      
      if (status === BehaviorStatus.RUNNING) {
        this.runningChildIndex = i;
        return BehaviorStatus.RUNNING;
      }
      
      if (status === BehaviorStatus.FAILURE) {
        this.runningChildIndex = 0;
        return BehaviorStatus.FAILURE;
      }
    }
    
    this.runningChildIndex = 0;
    return BehaviorStatus.SUCCESS;
  }
  
  reset(): void {
    this.runningChildIndex = 0;
    super.reset();
  }
}

/**
 * Parallel 노드
 * 모든 자식 노드를 동시에 실행
 * 정책에 따라 성공/실패 판정
 */
export class ParallelNode extends BehaviorNode {
  private successThreshold: number;
  private failureThreshold: number;
  
  constructor(
    id: string, 
    name: string = 'Parallel',
    successThreshold: number = 1,
    failureThreshold: number = 1
  ) {
    super(id, 'PARALLEL', name);
    this.successThreshold = successThreshold;
    this.failureThreshold = failureThreshold;
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    let successCount = 0;
    let failureCount = 0;
    
    for (const child of this.children) {
      const status = child.tick(blackboard);
      
      if (status === BehaviorStatus.SUCCESS) {
        successCount++;
      } else if (status === BehaviorStatus.FAILURE) {
        failureCount++;
      }
    }
    
    if (successCount >= this.successThreshold) {
      return BehaviorStatus.SUCCESS;
    }
    
    if (failureCount >= this.failureThreshold) {
      return BehaviorStatus.FAILURE;
    }
    
    return BehaviorStatus.RUNNING;
  }
}

// ============================================================
// Decorator Nodes
// ============================================================

/**
 * Inverter (NOT 노드)
 * 자식 노드의 결과를 반전
 * SUCCESS -> FAILURE, FAILURE -> SUCCESS, RUNNING -> RUNNING
 */
export class InverterNode extends BehaviorNode {
  constructor(id: string, name: string = 'Inverter') {
    super(id, 'INVERTER', name);
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    if (this.children.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    const status = this.children[0].tick(blackboard);
    
    if (status === BehaviorStatus.SUCCESS) {
      return BehaviorStatus.FAILURE;
    }
    
    if (status === BehaviorStatus.FAILURE) {
      return BehaviorStatus.SUCCESS;
    }
    
    return BehaviorStatus.RUNNING;
  }
}

/**
 * Repeater
 * 자식 노드를 지정된 횟수만큼 반복 (또는 무한 반복)
 */
export class RepeaterNode extends BehaviorNode {
  private maxRepeats: number;
  private currentRepeat: number = 0;
  
  constructor(id: string, name: string = 'Repeater', maxRepeats: number = -1) {
    super(id, 'REPEATER', name);
    this.maxRepeats = maxRepeats; // -1은 무한 반복
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    if (this.children.length === 0) {
      return BehaviorStatus.SUCCESS;
    }
    
    const status = this.children[0].tick(blackboard);
    
    if (status === BehaviorStatus.RUNNING) {
      return BehaviorStatus.RUNNING;
    }
    
    this.currentRepeat++;
    
    if (this.maxRepeats > 0 && this.currentRepeat >= this.maxRepeats) {
      this.currentRepeat = 0;
      return status;
    }
    
    // 계속 반복
    return BehaviorStatus.RUNNING;
  }
  
  reset(): void {
    this.currentRepeat = 0;
    super.reset();
  }
}

/**
 * Succeeder
 * 자식 노드의 결과에 관계없이 항상 SUCCESS 반환
 */
export class SucceederNode extends BehaviorNode {
  constructor(id: string, name: string = 'Succeeder') {
    super(id, 'SUCCEEDER', name);
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    if (this.children.length > 0) {
      const status = this.children[0].tick(blackboard);
      if (status === BehaviorStatus.RUNNING) {
        return BehaviorStatus.RUNNING;
      }
    }
    return BehaviorStatus.SUCCESS;
  }
}

// ============================================================
// Leaf Nodes
// ============================================================

/**
 * Condition 노드
 * 조건을 체크하고 즉시 SUCCESS 또는 FAILURE 반환
 */
export class ConditionNode extends BehaviorNode {
  private conditionFn: (blackboard: AIBlackboard) => boolean;
  
  constructor(
    id: string, 
    name: string, 
    conditionFn: (blackboard: AIBlackboard) => boolean
  ) {
    super(id, 'CONDITION', name);
    this.conditionFn = conditionFn;
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    try {
      const result = this.conditionFn(blackboard);
      return result ? BehaviorStatus.SUCCESS : BehaviorStatus.FAILURE;
    } catch (error) {
      logger.error(`[BehaviorTree] Condition "${this.name}" error:`, error);
      return BehaviorStatus.FAILURE;
    }
  }
}

/**
 * Action 노드
 * 실제 행동을 수행하고 결과 반환
 */
export class ActionNode extends BehaviorNode {
  private actionFn: (blackboard: AIBlackboard) => BehaviorStatus | Promise<BehaviorStatus>;
  private isAsync: boolean;
  private pendingPromise: Promise<BehaviorStatus> | null = null;
  private cachedResult: BehaviorStatus | null = null;
  
  constructor(
    id: string, 
    name: string, 
    actionFn: (blackboard: AIBlackboard) => BehaviorStatus | Promise<BehaviorStatus>,
    isAsync: boolean = false
  ) {
    super(id, 'ACTION', name);
    this.actionFn = actionFn;
    this.isAsync = isAsync;
  }
  
  tick(blackboard: AIBlackboard): BehaviorStatus {
    try {
      // 비동기 액션의 경우
      if (this.isAsync) {
        // 이미 결과가 있으면 반환
        if (this.cachedResult !== null) {
          const result = this.cachedResult;
          this.cachedResult = null;
          return result;
        }
        
        // 대기 중인 프로미스가 있으면 RUNNING
        if (this.pendingPromise !== null) {
          return BehaviorStatus.RUNNING;
        }
        
        // 새 비동기 작업 시작
        const result = this.actionFn(blackboard);
        if (result instanceof Promise) {
          this.pendingPromise = result.then(status => {
            this.cachedResult = status;
            this.pendingPromise = null;
            return status;
          }).catch(error => {
            logger.error(`[BehaviorTree] Action "${this.name}" async error:`, error);
            this.cachedResult = BehaviorStatus.FAILURE;
            this.pendingPromise = null;
            return BehaviorStatus.FAILURE;
          });
          return BehaviorStatus.RUNNING;
        }
        return result;
      }
      
      // 동기 액션
      const result = this.actionFn(blackboard);
      if (result instanceof Promise) {
        // 동기 모드에서 Promise 반환 시 에러 처리
        logger.warn(`[BehaviorTree] Action "${this.name}" returned Promise in sync mode`);
        return BehaviorStatus.FAILURE;
      }
      return result;
    } catch (error) {
      logger.error(`[BehaviorTree] Action "${this.name}" error:`, error);
      return BehaviorStatus.FAILURE;
    }
  }
  
  reset(): void {
    this.pendingPromise = null;
    this.cachedResult = null;
    super.reset();
  }
}

// ============================================================
// BehaviorTree Manager
// ============================================================

export class BehaviorTree {
  readonly id: string;
  readonly name: string;
  private root: BehaviorNode | null = null;
  
  constructor(id: string, name: string = 'BehaviorTree') {
    this.id = id;
    this.name = name;
  }
  
  setRoot(node: BehaviorNode): this {
    this.root = node;
    return this;
  }
  
  getRoot(): BehaviorNode | null {
    return this.root;
  }
  
  /**
   * 트리 실행
   */
  tick(blackboard: AIBlackboard): BehaviorStatus {
    if (!this.root) {
      logger.warn(`[BehaviorTree] Tree "${this.name}" has no root node`);
      return BehaviorStatus.FAILURE;
    }
    
    return this.root.tick(blackboard);
  }
  
  /**
   * 트리 리셋
   */
  reset(): void {
    this.root?.reset();
  }
  
  /**
   * 디버그용 트리 출력
   */
  toString(): string {
    let result = `=== BehaviorTree: ${this.name} (${this.id}) ===\n`;
    if (this.root) {
      result += this.root.toString();
    } else {
      result += '  (empty)\n';
    }
    return result;
  }
}

// ============================================================
// Tree Builder (Fluent API)
// ============================================================

export class BehaviorTreeBuilder {
  private tree: BehaviorTree;
  private nodeStack: BehaviorNode[] = [];
  private nodeIdCounter: number = 0;
  
  constructor(treeId: string, treeName: string = 'BehaviorTree') {
    this.tree = new BehaviorTree(treeId, treeName);
  }
  
  private generateId(prefix: string): string {
    return `${prefix}_${++this.nodeIdCounter}`;
  }
  
  private getCurrentParent(): BehaviorNode | null {
    return this.nodeStack.length > 0 ? this.nodeStack[this.nodeStack.length - 1] : null;
  }
  
  private addNode(node: BehaviorNode): this {
    const parent = this.getCurrentParent();
    if (parent) {
      parent.addChild(node);
    } else {
      this.tree.setRoot(node);
    }
    return this;
  }
  
  // Composite 노드 시작
  selector(name: string = 'Selector'): this {
    const node = new SelectorNode(this.generateId('sel'), name);
    this.addNode(node);
    this.nodeStack.push(node);
    return this;
  }
  
  sequence(name: string = 'Sequence'): this {
    const node = new SequenceNode(this.generateId('seq'), name);
    this.addNode(node);
    this.nodeStack.push(node);
    return this;
  }
  
  parallel(
    name: string = 'Parallel', 
    successThreshold: number = 1, 
    failureThreshold: number = 1
  ): this {
    const node = new ParallelNode(
      this.generateId('par'), 
      name, 
      successThreshold, 
      failureThreshold
    );
    this.addNode(node);
    this.nodeStack.push(node);
    return this;
  }
  
  // Composite 노드 종료
  end(): this {
    if (this.nodeStack.length > 0) {
      this.nodeStack.pop();
    }
    return this;
  }
  
  // Decorator 노드
  inverter(name: string = 'Inverter'): this {
    const node = new InverterNode(this.generateId('inv'), name);
    this.addNode(node);
    this.nodeStack.push(node);
    return this;
  }
  
  repeater(name: string = 'Repeater', maxRepeats: number = -1): this {
    const node = new RepeaterNode(this.generateId('rep'), name, maxRepeats);
    this.addNode(node);
    this.nodeStack.push(node);
    return this;
  }
  
  succeeder(name: string = 'Succeeder'): this {
    const node = new SucceederNode(this.generateId('suc'), name);
    this.addNode(node);
    this.nodeStack.push(node);
    return this;
  }
  
  // Leaf 노드
  condition(
    name: string, 
    conditionFn: (blackboard: AIBlackboard) => boolean
  ): this {
    const node = new ConditionNode(this.generateId('cond'), name, conditionFn);
    this.addNode(node);
    return this;
  }
  
  action(
    name: string, 
    actionFn: (blackboard: AIBlackboard) => BehaviorStatus | Promise<BehaviorStatus>,
    isAsync: boolean = false
  ): this {
    const node = new ActionNode(this.generateId('act'), name, actionFn, isAsync);
    this.addNode(node);
    return this;
  }
  
  // 빌드
  build(): BehaviorTree {
    return this.tree;
  }
}

// Export utility function
export function createBehaviorTree(
  id: string, 
  name: string = 'BehaviorTree'
): BehaviorTreeBuilder {
  return new BehaviorTreeBuilder(id, name);
}








