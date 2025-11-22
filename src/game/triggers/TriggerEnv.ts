export interface TriggerEnv {
  e_attacker: Record<string, any>;
  e_defender: Record<string, any>;
  stopNextAction?: boolean;
  [key: string]: any;
}

export function ensureTriggerEnv(env?: TriggerEnv | null): TriggerEnv {
  if (!env) {
    return { e_attacker: {}, e_defender: {} };
  }

  if (!env.e_attacker) {
    env.e_attacker = {};
  }

  if (!env.e_defender) {
    env.e_defender = {};
  }

  return env;
}
