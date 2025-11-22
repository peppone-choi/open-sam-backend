import { IUnitStackDocument, UnitOwnerType } from '../../models/unit_stack.model';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

export interface TransferUnitPayload {
  stackId: string;
  splitCount?: number;
  toOwnerType: UnitOwnerType;
  toOwnerId: string | number;
  toCityId?: number;
}

class UnitTransferService {
  async transfer(payload: TransferUnitPayload) {
    const stack = await unitStackRepository.findById(payload.stackId);
    if (!stack) {
      throw new Error('Unit stack not found');
    }

    let movingStack: IUnitStackDocument = stack;
    if (payload.splitCount && payload.splitCount > 0 && payload.splitCount < stack.stack_count) {
      const { child } = await unitStackRepository.splitStack(stack, payload.splitCount);
      movingStack = child;
    }

    movingStack.owner_type = payload.toOwnerType;
    movingStack.owner_id = payload.toOwnerId;

    if (payload.toCityId !== undefined) {
      movingStack.city_id = payload.toCityId;
    } else if (payload.toOwnerType === 'city') {
      movingStack.city_id = Number(payload.toOwnerId);
    }

    await movingStack.save();

    return movingStack;
  }

  async merge(targetId: string, donorId: string) {
    const target = await unitStackRepository.findById(targetId);
    const donor = await unitStackRepository.findById(donorId);

    if (!target || !donor) {
      throw new Error('Unit stack not found');
    }
    if (target.owner_type !== donor.owner_type || target.owner_id !== donor.owner_id) {
      throw new Error('Only stacks belonging to the same owner can be merged');
    }

    return unitStackRepository.mergeStacks(target, donor);
  }
}

export const unitTransferService = new UnitTransferService();
