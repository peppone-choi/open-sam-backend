
import mongoose from 'mongoose';
import { ExecuteEngineService } from './src/services/global/ExecuteEngine.service';
import { generalRepository } from './src/repositories/general.repository';
import { generalTurnRepository } from './src/repositories/general_turn.repository';
import { nationTurnRepository } from './src/repositories/nation_turn.repository';
import { PushCommandService } from './src/services/command/PushCommand.service';
import { PushCommandService as NationPushCommandService } from './src/services/nationcommand/PushCommand.service';

const MONGO_URI = 'mongodb://localhost:27017/open-sam-test-consumption';

async function setup() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
    }
    await mongoose.connection.dropDatabase();
}

async function teardown() {
    await mongoose.connection.close();
}

async function testGeneralCommandConsumption() {
    console.log('--- Testing General Command Consumption ---');
    const sessionId = 'test_session';
    const generalId = 1001;

    // 1. Create a general
    await generalRepository.create({
        session_id: sessionId,
        no: generalId,
        name: 'TestGeneral',
        npc: 0, // Player
        turntime: new Date().toISOString(), // Ready to execute
        turn_count: 0,
        gold: 1000,
        rice: 1000,
        crew: 100,
        train: 100,
        atmos: 100,
        city: 1,
        nation: 1,
        officer_level: 5, // For nation command test later
    });

    // 2. Push commands
    // Turn 0: Rest (Default)
    // Turn 1: Commercial Development (Example)
    // Turn 2: Agricultural Development (Example)
    await PushCommandService.execute({
        session_id: sessionId,
        general_id: generalId,
        action: '상업',
        arg: {},
        amount: 1, // Push 1 turn
    });

    // Push another command to be at turn 2 (effectively)
    // Note: PushCommandService pushes to the *end* or shifts. 
    // Let's manually set turns to be sure of the state before execution.
    await generalTurnRepository.deleteMany({ session_id: sessionId, 'data.general_id': generalId });

    await generalTurnRepository.create({
        session_id: sessionId,
        data: { general_id: generalId, turn_idx: 0, action: '휴식', arg: {}, brief: '휴식' }
    });
    await generalTurnRepository.create({
        session_id: sessionId,
        data: { general_id: generalId, turn_idx: 1, action: '상업', arg: {}, brief: '상업' }
    });
    await generalTurnRepository.create({
        session_id: sessionId,
        data: { general_id: generalId, turn_idx: 2, action: '농업', arg: {}, brief: '농업' }
    });

    console.log('Initial Turns:');
    const initialTurns = await generalTurnRepository.findByFilter({ session_id: sessionId, 'data.general_id': generalId });
    initialTurns.sort((a, b) => a.data.turn_idx - b.data.turn_idx);
    initialTurns.forEach(t => console.log(`Turn ${t.data.turn_idx}: ${t.data.action}`));

    // 3. Execute Turn
    // We need to simulate the engine calling executeGeneralTurn
    // Since executeGeneralTurn is private, we might need to call a public method that calls it, 
    // or use `(ExecuteEngineService as any).executeGeneralTurn` if we can bypass TS checks, 
    // or just call `(ExecuteEngineService as any).pullGeneralCommand` directly to verify consumption logic specifically.
    // The user wants to verify "consumption logic", so testing pullGeneralCommand directly is a good start.
    // But testing the full flow is better. `executeGeneralCommandUntil` is public (in PHP) but here `execute` is the main entry point?
    // `ExecuteEngineService.run` is the main loop.

    // Let's try to invoke `executeGeneralTurn` via `(ExecuteEngineService as any)`
    const gameEnv = { year: 184, month: 1, turnterm: 10 };
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

    console.log('Executing General Turn...');
    // Mocking getTurnTime and other methods if necessary, but general is a Mongoose doc here.
    // ExecuteEngineService expects a plain object or document.

    // We will call the private method via casting to any
    await (ExecuteEngineService as any).processGeneralCommand(sessionId, general, 184, 1, gameEnv);

    // After processing, the engine calls pullGeneralCommand.
    // Wait, processGeneralCommand does NOT call pullGeneralCommand. 
    // executeGeneralTurn calls processGeneralCommand AND THEN pullGeneralCommand.
    // Let's call pullGeneralCommand manually to verify IT works.

    await (ExecuteEngineService as any).pullGeneralCommand(sessionId, generalId, 1, false, 'TestGeneral');

    // 4. Verify Turns
    console.log('Turns After Execution & Pull:');
    const afterTurns = await generalTurnRepository.findByFilter({ session_id: sessionId, 'data.general_id': generalId });
    afterTurns.sort((a, b) => a.data.turn_idx - b.data.turn_idx);
    afterTurns.forEach(t => console.log(`Turn ${t.data.turn_idx}: ${t.data.action}`));

    // Expected:
    // Old Turn 1 ('상업') becomes Turn 0
    // Old Turn 2 ('농업') becomes Turn 1
    const turn0 = afterTurns.find(t => t.data.turn_idx === 0);
    const turn1 = afterTurns.find(t => t.data.turn_idx === 1);

    if (turn0?.data.action === '상업' && turn1?.data.action === '농업') {
        console.log('✅ General Command Consumption Verified');
    } else {
        console.error('❌ General Command Consumption Failed');
    }
}

async function testNationCommandConsumption() {
    console.log('\n--- Testing Nation Command Consumption ---');
    const sessionId = 'test_session';
    const nationId = 1;
    const officerLevel = 5;

    // 1. Setup Nation Turns
    await nationTurnRepository.deleteMany({ session_id: sessionId, 'data.nation_id': nationId });

    await nationTurnRepository.create({
        session_id: sessionId,
        data: { nation_id: nationId, officer_level: officerLevel, turn_idx: 0, action: '휴식', arg: {}, brief: '휴식' }
    });
    await nationTurnRepository.create({
        session_id: sessionId,
        data: { nation_id: nationId, officer_level: officerLevel, turn_idx: 1, action: '징병', arg: {}, brief: '징병' }
    });

    console.log('Initial Nation Turns:');
    const initialTurns = await nationTurnRepository.findByFilter({ session_id: sessionId, 'data.nation_id': nationId });
    initialTurns.sort((a, b) => a.data.turn_idx - b.data.turn_idx);
    initialTurns.forEach(t => console.log(`Turn ${t.data.turn_idx}: ${t.data.action}`));

    // 2. Execute Pull
    await (ExecuteEngineService as any).pullNationCommand(sessionId, nationId, officerLevel, 1);

    // 3. Verify
    console.log('Nation Turns After Pull:');
    const afterTurns = await nationTurnRepository.findByFilter({ session_id: sessionId, 'data.nation_id': nationId });
    afterTurns.sort((a, b) => a.data.turn_idx - b.data.turn_idx);
    afterTurns.forEach(t => console.log(`Turn ${t.data.turn_idx}: ${t.data.action}`));

    const turn0 = afterTurns.find(t => t.data.turn_idx === 0);
    if (turn0?.data.action === '징병') {
        console.log('✅ Nation Command Consumption Verified');
    } else {
        console.error('❌ Nation Command Consumption Failed');
    }
}

async function main() {
    try {
        await setup();
        await testGeneralCommandConsumption();
        await testNationCommandConsumption();
    } catch (e) {
        console.error(e);
    } finally {
        await teardown();
    }
}

main();
