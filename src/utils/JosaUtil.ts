export class JosaUtil {
  static pick(word: string | number, josaType: string): string {
    const wordStr = String(word);
    if (!wordStr || wordStr.length === 0) {
      return '';
    }

    const lastChar = wordStr[wordStr.length - 1];
    const lastCharCode = lastChar.charCodeAt(0);
    
    const hasJongseong = this.hasJongseong(lastChar);

    switch (josaType) {
      case '이':
      case '가':
        return hasJongseong ? '이' : '가';
      
      case '은':
      case '는':
        return hasJongseong ? '은' : '는';
      
      case '을':
      case '를':
        return hasJongseong ? '을' : '를';
      
      case '과':
      case '와':
        return hasJongseong ? '과' : '와';
      
      case '으로':
      case '로':
        if (!hasJongseong) {
          return '로';
        }
        const jong = (lastCharCode - 0xAC00) % 28;
        return jong === 8 ? '로' : '으로';
      
      case '아':
      case '야':
        return hasJongseong ? '아' : '야';
      
      case '이여':
      case '여':
        return hasJongseong ? '이여' : '여';
      
      case '이랑':
      case '랑':
        return hasJongseong ? '이랑' : '랑';
      
      default:
        return josaType;
    }
  }

  private static hasJongseong(char: string): boolean {
    const code = char.charCodeAt(0);
    
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const jong = (code - 0xAC00) % 28;
      return jong !== 0;
    }
    
    if (code >= 0x3131 && code <= 0x314E) {
      return false;
    }
    
    if (code >= 0x314F && code <= 0x3163) {
      return false;
    }
    
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      const consonants = ['L', 'M', 'N', 'R', 'l', 'm', 'n', 'r', '0', '1', '3', '6', '7', '8'];
      return consonants.includes(char);
    }
    
    return false;
  }

  static format(word: string | number, josaType: string): string {
    return String(word) + this.pick(word, josaType);
  }

  static eul(word: string | number): string {
    return this.pick(word, '을');
  }

  static i(word: string | number): string {
    return this.pick(word, '이');
  }

  static eun(word: string | number): string {
    return this.pick(word, '은');
  }

  static gwa(word: string | number): string {
    return this.pick(word, '과');
  }

  static ro(word: string | number): string {
    return this.pick(word, '로');
  }

  static a(word: string | number): string {
    return this.pick(word, '아');
  }

  static rang(word: string | number): string {
    return this.pick(word, '랑');
  }
}
