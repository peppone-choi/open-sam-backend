import { FilterQuery, UpdateQuery } from 'mongoose';
import { IUnitStack, IUnitStackDocument, UnitOwnerType, UnitStack } from '../models/unit_stack.model';

class UnitStackRepository {
  async findByOwner(
    sessionId: string,
    ownerType: UnitOwnerType,
    ownerId: string | number
  ): Promise<IUnitStack[]> {
    const docs = await UnitStack.find({
      session_id: sessionId,
      owner_type: ownerType,
      owner_id: ownerId
    })
      .lean()
      .exec();
    return (docs || []) as IUnitStack[];
  }

  async findById(id: string): Promise<IUnitStackDocument | null> {
    return UnitStack.findById(id);
  }

  async create(payload: Partial<IUnitStack>): Promise<IUnitStackDocument> {
    const stack = new UnitStack(payload);
    await stack.save();
    return stack;
  }

  async bulkCreate(
    sessionId: string,
    ownerType: UnitOwnerType,
    ownerId: string | number,
    stacks: Array<Partial<IUnitStack>>
  ): Promise<IUnitStackDocument[]> {
    if (!stacks.length) return [];
    const docs: IUnitStack[] = stacks.map((stack) => {
      const unitSize = stack.unit_size ?? 100;
      const stackCount = stack.stack_count ?? 0;
      return {
        session_id: sessionId,
        owner_type: ownerType,
        owner_id: ownerId,
        commander_no: stack.commander_no,
        commander_name: stack.commander_name,
        crew_type_id: stack.crew_type_id ?? 0,
        crew_type_name: stack.crew_type_name ?? '병종',
        crew_type_icon: stack.crew_type_icon,
        unit_size: unitSize,
        stack_count: stackCount,
        train: stack.train ?? 70,
        morale: stack.morale ?? 70,
        hp: stack.hp ?? unitSize * stackCount,
        attack: stack.attack ?? 0,
        defence: stack.defence ?? 0,
        equipment: stack.equipment ?? {},
        status: stack.status ?? 'active',
        note: stack.note,
        city_id: stack.city_id,
        created_at: stack.created_at,
        updated_at: stack.updated_at,
      };
    });
    return UnitStack.insertMany(docs);
  }

  async updateById(id: string, update: UpdateQuery<IUnitStack>) {
    return UnitStack.findByIdAndUpdate(id, update, { new: true });
  }

  async deleteById(id: string) {
    return UnitStack.findByIdAndDelete(id);
  }

  async deleteByOwner(sessionId: string, ownerType: UnitOwnerType, ownerId: string | number) {
    return UnitStack.deleteMany({ session_id: sessionId, owner_type: ownerType, owner_id: ownerId });
  }

  async deleteBySession(sessionId: string) {
    return UnitStack.deleteMany({ session_id: sessionId });
  }

  async updateOwnersCity(sessionId: string, ownerIds: Array<string | number>, cityId: number | null) {
    if (!ownerIds || ownerIds.length === 0) return;
    const normalizedIds = ownerIds
      .map((id) => typeof id === 'number' ? id : Number(id))
      .filter((id) => Number.isFinite(id));
    if (!normalizedIds.length) return;
    return UnitStack.updateMany({
      session_id: sessionId,
      owner_type: 'general',
      owner_id: { $in: normalizedIds }
    }, {
      city_id: cityId ?? null,
    });
  }

  async splitStack(stack: IUnitStackDocument, splitCount: number) {
    if (splitCount <= 0 || splitCount >= stack.stack_count) {
      throw new Error('splitCount must be between 1 and stack_count - 1');
    }

    stack.stack_count -= splitCount;
    stack.hp = Math.min(stack.hp, stack.unit_size * stack.stack_count);
    await stack.save();

    const newStack = await this.create({
      session_id: stack.session_id,
      owner_type: stack.owner_type,
      owner_id: stack.owner_id,
      commander_no: stack.commander_no,
      commander_name: stack.commander_name,
      crew_type_id: stack.crew_type_id,
      crew_type_name: stack.crew_type_name,
      crew_type_icon: stack.crew_type_icon,
      unit_size: stack.unit_size,
      stack_count: splitCount,
      train: stack.train,
      morale: stack.morale,
      hp: stack.unit_size * splitCount,
      attack: stack.attack,
      defence: stack.defence,
      equipment: stack.equipment,
    });

    return { parent: stack, child: newStack };
  }

  async mergeStacks(target: IUnitStackDocument, donor: IUnitStackDocument) {
    if (target.crew_type_id !== donor.crew_type_id || target.unit_size !== donor.unit_size) {
      throw new Error('Crew type and unit size must match to merge stacks');
    }

    target.stack_count += donor.stack_count;
    target.hp = Math.min(target.unit_size * target.stack_count, target.hp + donor.hp);
    target.train = Math.round((target.train + donor.train) / 2);
    target.morale = Math.round((target.morale + donor.morale) / 2);

    await target.save();
    await donor.deleteOne();
    return target;
  }

  async transferOwner(stackId: string, ownerType: UnitOwnerType, ownerId: string | number) {
    return UnitStack.findByIdAndUpdate(
      stackId,
      {
        owner_type: ownerType,
        owner_id: ownerId
      },
      { new: true }
    );
  }

  async updateOwnerCity(sessionId: string, ownerType: UnitOwnerType, ownerId: string | number, cityId: number | null) {
    return UnitStack.updateMany({
      session_id: sessionId,
      owner_type: ownerType,
      owner_id: ownerId,
    }, {
      city_id: cityId ?? null,
    });
  }

  async find(filter: FilterQuery<IUnitStackDocument>): Promise<IUnitStack[]> {
    const docs = await UnitStack.find(filter)
      .lean()
      .exec();
    return (docs || []) as IUnitStack[];
  }
}

export const unitStackRepository = new UnitStackRepository();
