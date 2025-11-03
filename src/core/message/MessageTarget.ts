/**
 * MessageTarget
 * 
 * PHP 버전의 sammo\MessageTarget 클래스를 TypeScript로 변환
 */
export class MessageTarget {
  constructor(
    public generalID: number,
    public generalName: string,
    public nationID: number,
    public nationName: string,
    public nationColor: string = '#000000',
    public imageURL: string = ''
  ) {}

  /**
   * 배열로 변환
   */
  public toArray(): Record<string, any> {
    return {
      generalID: this.generalID,
      generalName: this.generalName,
      nationID: this.nationID,
      nationName: this.nationName,
      nationColor: this.nationColor,
      imageURL: this.imageURL
    };
  }

  /**
   * 배열에서 빌드
   */
  public static buildFromArray(data: Record<string, any>): MessageTarget {
    return new MessageTarget(
      data.generalID || 0,
      data.generalName || '',
      data.nationID || 0,
      data.nationName || '',
      data.nationColor || '#000000',
      data.imageURL || ''
    );
  }
}

