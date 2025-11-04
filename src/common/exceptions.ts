/**
 * 예외 처리 클래스들 - PHP 예외 클래스 변환
 */

/**
 * 도달하면 안 되는 코드에 도달했을 때 발생하는 예외
 */
export class MustNotBeReachedException extends Error {
  constructor(message: string = 'Must not be reached') {
    super(message);
    this.name = 'MustNotBeReachedException';
    Object.setPrototypeOf(this, MustNotBeReachedException.prototype);
  }
}

/**
 * 데이터베이스 결과가 없을 때 발생하는 예외
 */
export class NoDBResultException extends Error {
  constructor(message: string = 'No database result') {
    super(message);
    this.name = 'NoDBResultException';
    Object.setPrototypeOf(this, NoDBResultException.prototype);
  }
}

/**
 * 구현되지 않은 메서드 호출 시 발생하는 예외
 */
export class NotImplementedException extends Error {
  constructor(message: string = 'Not implemented') {
    super(message);
    this.name = 'NotImplementedException';
    Object.setPrototypeOf(this, NotImplementedException.prototype);
  }
}

/**
 * 상속받지 않은 메서드 호출 시 발생하는 예외
 */
export class NotInheritedMethodException extends Error {
  constructor(message: string = 'Method must be inherited') {
    super(message);
    this.name = 'NotInheritedMethodException';
    Object.setPrototypeOf(this, NotInheritedMethodException.prototype);
  }
}



