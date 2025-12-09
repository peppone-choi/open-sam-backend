import { GeneralCommand } from '../base/GeneralCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { unitTransferService } from '../../services/unit/UnitTransfer.service';
import { IUnitStack } from '../../models/unit_stack.model';
import { cityRepository } from '../../repositories/city.repository';
import type { ICity } from '../../models/city.model';

interface ReassignUnitArg {
  stackId: string;
  splitCount?: number;
  targetCityId?: number;
}

/**
 * 주둔/장수 병력 재배치
 * - 장수가 보유한 유닛 스택 전체 또는 일부를 현재 도시 혹은 지정 도시 수비대로 이동
 */
export class ReassignUnitCommand extends GeneralCommand {
  protected static actionName = '주둔 재배치';
  public static override reqArg = true;
  private parsedArg!: Required<Pick<ReassignUnitArg, 'stackId'>> & {
    splitCount?: number;
    targetCityId?: number;
  };

  protected argTest(): boolean {
    console.log('[주둔 재배치] argTest 시작 - arg:', JSON.stringify(this.arg));
    
    if (!this.arg) {
      console.log('[주둔 재배치] argTest 실패: arg가 null/undefined');
      return false;
    }
    const { stackId, splitCount, targetCityId } = this.arg as ReassignUnitArg;
    console.log('[주둔 재배치] 파싱된 인자 - stackId:', stackId, 'type:', typeof stackId, 'splitCount:', splitCount, 'targetCityId:', targetCityId);

    if (typeof stackId !== 'string' || !stackId.trim()) {
      console.log('[주둔 재배치] argTest 실패: stackId가 유효한 문자열이 아님');
      return false;
    }

    if (splitCount !== undefined && (typeof splitCount !== 'number' || Number.isNaN(splitCount) || splitCount <= 0)) {
      console.log('[주둔 재배치] argTest 실패: splitCount가 유효하지 않음');
      return false;
    }

    if (targetCityId !== undefined && (typeof targetCityId !== 'number' || Number.isNaN(targetCityId))) {
      console.log('[주둔 재배치] argTest 실패: targetCityId가 유효하지 않음');
      return false;
    }

    const normalizedSplit = splitCount !== undefined
      ? Math.max(1, Math.floor(splitCount))
      : undefined;

    const normalizedTarget = targetCityId !== undefined
      ? Number(targetCityId)
      : undefined;

    this.parsedArg = {
      stackId: stackId.trim(),
      ...(normalizedSplit ? { splitCount: normalizedSplit } : {}),
      ...(normalizedTarget ? { targetCityId: normalizedTarget } : {})
    };
    this.arg = this.parsedArg;
    return true;
  }

  protected init(): void {
    const minConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity()
    ];
    this.minConditionConstraints = minConstraints;
    this.fullConditionConstraints = minConstraints;
  }

  protected override initWithArg(): void {
    if (!this.parsedArg) {
      return;
    }

    if (this.parsedArg.targetCityId) {
      this.setDestCity(this.parsedArg.targetCityId);
      const extraConstraints = [
        ConstraintHelper.OccupiedDestCity(),
        ConstraintHelper.SuppliedDestCity()
      ];
      this.minConditionConstraints = [
        ...(this.minConditionConstraints ?? []),
        ...extraConstraints
      ];
      this.fullConditionConstraints = [
        ...(this.fullConditionConstraints ?? []),
        ...extraConstraints
      ];
    }
  }

  public getCommandDetailTitle(): string {
    return `${(this.constructor as typeof ReassignUnitCommand).getName()}(병력/수비 재배치)`;
  }

  public getBrief(): string {
    return '보유 유닛을 도시 수비대로 이동';
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(): Promise<boolean> {
    const general = this.generalObj;
    const generalNo = general.getID?.() ?? general.no ?? general.data?.no;
    if (!generalNo) {
      throw new Error('장수 ID를 확인할 수 없습니다.');
    }

    const sessionId = this.env.session_id || 'sangokushi_default';
    const currentCityId = general.city ?? general.data?.city;
    const args = this.parsedArg;
    if (!args) {
      throw new Error('명령 인자가 지정되지 않았습니다.');
    }
    const targetCityId = args.targetCityId ?? currentCityId;

    if (!targetCityId) {
      throw new Error('재배치할 도시를 찾을 수 없습니다.');
    }

    const stack = await unitStackRepository.findById(args.stackId);
    if (!stack) {
      throw new Error('해당 유닛 스택을 찾을 수 없습니다.');
    }

    if (stack.session_id && stack.session_id !== sessionId) {
      throw new Error('다른 시나리오의 병력은 재배치할 수 없습니다.');
    }

    const stackId = (stack as any).id ?? stack._id?.toString?.();
    if (!stackId) {
      throw new Error('병력 정보를 확인할 수 없습니다.');
    }

    const splitCount = args.splitCount;
    if (splitCount && splitCount >= (stack.stack_count ?? 0)) {
      throw new Error('분할 수량이 스택 전체를 초과할 수 없습니다.');
    }

    // 국가 ID 가져오기 (여러 소스에서 확인)
    const generalRaw = this.generalObj as any;
    const nationId = Number(
      this.generalObj.getNationID?.() ?? 
      this.generalObj.nation ?? 
      generalRaw?.data?.nation ?? 
      generalRaw?.nation ?? 
      0
    );
    
    console.log(`[주둔 재배치] 국가 ID 확인 - nationId: ${nationId}, generalNo: ${generalNo}, targetCityId: ${targetCityId}`);

    const ownerId = typeof stack.owner_id === 'number' ? stack.owner_id : Number(stack.owner_id);
    if (stack.owner_type === 'general' && ownerId === generalNo) {
      await this.ensureCityBelongsToNation(targetCityId, nationId);
      await this.transferFromGeneral(stackId, splitCount, targetCityId, currentCityId);
      return true;
    }

    if (stack.owner_type === 'city') {
      const sourceCityId = Number(stack.owner_id);
      await this.ensureCityBelongsToNation(sourceCityId, nationId);
      await this.transferFromCity(stackId, splitCount, sourceCityId, currentCityId);
      return true;
    }

    throw new Error('지원되지 않는 병력 소유자 유형입니다.');
  }

  private async transferFromGeneral(
    stackId: string,
    splitCount: number | undefined,
    targetCityId: number | undefined,
    fallbackCityId: number
  ) {
    const destinationCityId = targetCityId ?? fallbackCityId;
    if (!destinationCityId) {
      throw new Error('재배치할 도시를 찾을 수 없습니다.');
    }
    const generalRaw = this.generalObj as any;
    const nationId = Number(
      this.generalObj.getNationID?.() ?? 
      this.generalObj.nation ?? 
      generalRaw?.data?.nation ?? 
      generalRaw?.nation ?? 
      0
    );
    await this.ensureCityBelongsToNation(destinationCityId, nationId);

    const movedStack = await unitTransferService.transfer({
      stackId,
      splitCount,
      toOwnerType: 'city',
      toOwnerId: destinationCityId,
      toCityId: destinationCityId,
    });
 
    this.markUnitStacksDirty();
    await this.writeTransferToCityLog(movedStack, destinationCityId);

  }

  private async transferFromCity(
    stackId: string,
    splitCount: number | undefined,
    sourceCityId: number,
    generalCityId: number
  ) {
    if (!generalCityId || sourceCityId !== generalCityId) {
      throw new Error('현재 주둔 중인 도시의 수비병만 불러올 수 있습니다.');
    }

    const general = this.generalObj;
    const generalNo = general.getID?.() ?? general.no ?? general.data?.no;
    if (!generalNo) {
      throw new Error('장수 정보를 확인할 수 없습니다.');
    }

    const movedStack = await unitTransferService.transfer({
      stackId,
      splitCount,
      toOwnerType: 'general',
      toOwnerId: generalNo,
      toCityId: generalCityId,
    });
 
    this.markUnitStacksDirty();
    await this.writeTransferToGeneralLog(movedStack, sourceCityId);

  }

  private async writeTransferToCityLog(stack: IUnitStack, cityId: number) {
    const logger = this.generalObj.getLogger();
    const troopCount = stack.unit_size * stack.stack_count;
    const crewName = stack.crew_type_name;

    const city = await cityRepository.findByCityNum(this.env.session_id, cityId) as any;
    const cityName = city?.name ?? `도시 ${cityId}`;
    const generalRaw = this.generalObj as any;
    const generalName = generalRaw?.name ?? generalRaw?.data?.name ?? '장수';
    const nationName = (this.nation as any)?.name ?? '무소속';

    logger.pushGeneralActionLog(`${cityName}에 ${crewName} <C>${troopCount.toLocaleString()}</>명을 배치했습니다.`);
    logger.pushGlobalActionLog?.(
      `<D><b>${nationName}</b></>의 <Y>${generalName}</>이(가) ${cityName} 방어를 강화했습니다. (${crewName} ${troopCount.toLocaleString()}명)`
    );
  }

  private async writeTransferToGeneralLog(stack: IUnitStack, cityId: number) {
    const logger = this.generalObj.getLogger();
    const troopCount = stack.unit_size * stack.stack_count;
    const crewName = stack.crew_type_name;

    const city = await cityRepository.findByCityNum(this.env.session_id, cityId) as any;
    const cityName = city?.name ?? `도시 ${cityId}`;
    const generalRaw = this.generalObj as any;
    const generalName = generalRaw?.name ?? generalRaw?.data?.name ?? '장수';

    logger.pushGeneralActionLog(`${cityName} 수비에서 ${crewName} <C>${troopCount.toLocaleString()}</>명을 불러왔습니다.`);
    logger.pushGlobalActionLog?.(
      `<Y>${generalName}</>이(가) ${cityName} 수비병 중 ${crewName} ${troopCount.toLocaleString()}명을 지휘하기 위해 이관했습니다.`
    );
  }

  private async ensureCityBelongsToNation(cityId: number, nationId: number): Promise<void> {
    const sessionId = this.env.session_id || 'sangokushi_default';
    const city = (await cityRepository.findByCityNum(sessionId, cityId)) as Partial<ICity> | null;
    if (!city) {
      throw new Error('대상 도시를 찾을 수 없습니다.');
    }
    const cityNation = Number((city as any).nation ?? (city as any).data?.nation ?? 0);
    const myNation = Number(nationId);
    
    console.log(`[주둔 재배치] 도시 소속 확인 - cityId: ${cityId}, cityNation: ${cityNation}, myNation: ${myNation}`);
    
    if (cityNation !== myNation) {
      throw new Error(`아국 도시가 아닙니다. (도시 소속: ${cityNation}, 내 국가: ${myNation})`);
    }
  }
}
