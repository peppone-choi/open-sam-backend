import { Router, Request, Response } from 'express';

const router = Router();

router.post('/simulator/battle', async (req: Request, res: Response) => {
  try {
    const { attacker, defender, terrain = 'plains' } = req.body;

    const atkPower = 
      (attacker.leadership + attacker.strength) * 
      attacker.crew * 
      (attacker.train / 100) * 
      (attacker.atmos / 100);

    const defPower = 
      (defender.leadership + defender.strength) * 
      defender.crew * 
      (defender.train / 100) * 
      (defender.atmos / 100);

    const ratio = defPower > 0 ? atkPower / defPower : 100;
    const winner = atkPower > defPower ? 'attacker' : 'defender';

    const atkLoss = Math.floor(attacker.crew * (winner === 'attacker' ? 0.2 : 0.5));
    const defLoss = Math.floor(defender.crew * (winner === 'defender' ? 0.2 : 0.5));

    res.json({
      result: true,
      simulation: {
        winner,
        ratio,
        atkPower: Math.round(atkPower),
        defPower: Math.round(defPower),
        atkLoss,
        defLoss,
        atkRemaining: attacker.crew - atkLoss,
        defRemaining: defender.crew - defLoss,
      },
    });
  } catch (error) {
    console.error('Error in simulator/battle:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
