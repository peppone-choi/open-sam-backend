/**
 * 예외 클래스들 - PHP 예외 클래스 변환
 */

/**
 * NotImplementedException
 */
export class NotImplementedException extends Error {
  constructor(message: string = '아직 구현되지 않았습니다') {
    super(message);
    this.name = 'NotImplementedException';
  }
}

/**
 * NoDBResultException
 */
export class NoDBResultException extends Error {
  constructor(message: string = 'DB 결과가 없습니다') {
    super(message);
    this.name = 'NoDBResultException';
  }
}

/**
 * NotInheritedMethodException
 */
export class NotInheritedMethodException extends Error {
  constructor(message: string = '상속되지 않은 메서드입니다') {
    super(message);
    this.name = 'NotInheritedMethodException';
  }
}

/**
 * MustNotBeReachedException
 */
export class MustNotBeReachedException extends Error {
  constructor(message: string = '이 코드에 도달하면 안 됩니다') {
    super(message);
    this.name = 'MustNotBeReachedException';
  }
}



