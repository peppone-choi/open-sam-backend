/**
 * TVarDumper - 변수 덤프 유틸리티
 * PHP의 var_dump와 유사한 기능 제공
 */

export class TVarDumper {
  private static objects: WeakSet<object> = new WeakSet();
  private static output: string = '';
  private static depth: number = 10;

  /**
   * 변수를 문자열로 덤프
   * @param var 변수
   * @param depth 최대 깊이
   * @param highlight 하이라이트 여부 (미구현)
   */
  static dump(var_: any, depth: number = 10, highlight: boolean = false): string {
    TVarDumper.output = '';
    TVarDumper.objects = new WeakSet();
    TVarDumper.depth = depth;
    TVarDumper.dumpInternal(var_, 0);
    
    if (highlight) {
      // 하이라이트는 나중에 구현 가능
      return TVarDumper.output;
    }
    return TVarDumper.output;
  }

  private static dumpInternal(var_: any, level: number): string {
    const type = typeof var_;

    switch (type) {
      case 'boolean':
        TVarDumper.output += var_ ? 'true' : 'false';
        break;
      case 'number':
        TVarDumper.output += String(var_);
        break;
      case 'string':
        TVarDumper.output += `'${var_}'`;
        break;
      case 'undefined':
        TVarDumper.output += 'undefined';
        break;
      case 'function':
        TVarDumper.output += '{function}';
        break;
      case 'symbol':
        TVarDumper.output += '{symbol}';
        break;
      case 'object':
        if (var_ === null) {
          TVarDumper.output += 'null';
        } else if (Array.isArray(var_)) {
          if (TVarDumper.depth <= level) {
            TVarDumper.output += 'array(...)';
          } else if (var_.length === 0) {
            TVarDumper.output += 'array()';
          } else {
            const spaces = ' '.repeat(level * 4);
            TVarDumper.output += `array\n${spaces}(`;
            for (let i = 0; i < var_.length; i++) {
              TVarDumper.output += `\n${spaces}    [${i}] => `;
              TVarDumper.dumpInternal(var_[i], level + 1);
            }
            TVarDumper.output += `\n${spaces})`;
          }
        } else {
          // 객체인 경우
          if (TVarDumper.depth <= level) {
            const className = var_.constructor?.name || 'Object';
            TVarDumper.output += `${className}(...)`;
          } else {
            const className = var_.constructor?.name || 'Object';
            const spaces = ' '.repeat(level * 4);
            TVarDumper.output += `${className}\n${spaces}(`;
            
            const keys = Object.keys(var_);
            for (const key of keys) {
              TVarDumper.output += `\n${spaces}    [${key}] => `;
              TVarDumper.dumpInternal(var_[key], level + 1);
            }
            TVarDumper.output += `\n${spaces})`;
          }
        }
        break;
      default:
        TVarDumper.output += '{unknown}';
        break;
    }

    return TVarDumper.output;
  }
}



