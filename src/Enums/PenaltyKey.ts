/**
 * Penalty Key
 * 장수의 penalty 항목
 * 
 * PHP 대응: core/hwe/sammo/Enums/PenaltyKey.php
 */
export enum PenaltyKey {
  /** 개인 메세지 보내기 제한 시간 */
  SendPrivateMsgDelay = 'sendPrivateMsgDelay',
  /** 개인 메세지 보내기 금지 */
  NoSendPrivateMsg = 'noSendPrivateMsg',
  /** 공개 메세지 보내기 금지 */
  NoSendPublicMsg = 'noSendPublicMsg',
  /** 암행부 열람 금지 */
  NoTopSecret = 'noTopSecret',
  /** 수뇌 금지 */
  NoChief = 'noChief',
  /** 외교권자 금지 */
  NoAmbassador = 'noAmbassador',
  /** 장수 추방 금지 */
  NoBanGeneral = 'noBanGeneral',
  /** 수뇌 턴 입력 금지 */
  NoChiefTurnInput = 'noChiefTurnInput',
  /** 수뇌 임명/해임 금지 */
  NoChiefChange = 'noChiefChange',
  /** 건국 금지 */
  NoFoundNation = 'noFoundNation',
  /** 지정 임관 금지 */
  NoChosenAssignment = 'noChosenAssignment',
}

/**
 * PenaltyKey에 대한 도움말 텍스트 반환
 */
export function getPenaltyHelpText(key: PenaltyKey): string {
  switch (key) {
    case PenaltyKey.SendPrivateMsgDelay:
      return '개인 메세지 보내기 제한 시간';
    case PenaltyKey.NoSendPrivateMsg:
      return '개인 메세지 보내기 금지';
    case PenaltyKey.NoSendPublicMsg:
      return '공개 메세지 보내기 금지';
    case PenaltyKey.NoTopSecret:
      return '암행부 열람 금지';
    case PenaltyKey.NoChief:
      return '수뇌 금지';
    case PenaltyKey.NoAmbassador:
      return '외교권자 금지';
    case PenaltyKey.NoBanGeneral:
      return '장수 추방 금지';
    case PenaltyKey.NoChiefTurnInput:
      return '수뇌 턴 입력 금지';
    case PenaltyKey.NoChiefChange:
      return '수뇌 임명/해임 금지';
    case PenaltyKey.NoFoundNation:
      return '건국 금지';
    case PenaltyKey.NoChosenAssignment:
      return '지정 임관 금지';
    default:
      return `페널티(${key})`;
  }
}

/**
 * 문자열을 PenaltyKey로 변환 (tryFrom 대응)
 */
export function tryPenaltyKeyFrom(value: string): PenaltyKey | null {
  const values = Object.values(PenaltyKey);
  if (values.includes(value as PenaltyKey)) {
    return value as PenaltyKey;
  }
  return null;
}

