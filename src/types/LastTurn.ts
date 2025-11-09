export class LastTurn {
  private commandName: string;
  private arg: any;
  private reqTurn: number;
  private term: number;
  private seq: number;

  constructor(commandName: string = '', arg: any = {}, reqTurn: number = 0) {
    this.commandName = commandName;
    this.arg = arg;
    this.reqTurn = reqTurn;
    this.term = 0;
    this.seq = 0;
  }

  getCommandName(): string {
    return this.commandName;
  }

  getArg(): any {
    return this.arg;
  }

  getReqTurn(): number {
    return this.reqTurn;
  }

  getTerm(): number {
    return this.term;
  }

  getSeq(): number {
    return this.seq;
  }

  setCommandName(commandName: string): void {
    this.commandName = commandName;
  }

  setArg(arg: any): void {
    this.arg = arg;
  }

  setReqTurn(reqTurn: number): void {
    this.reqTurn = reqTurn;
  }

  setTerm(term: number): void {
    this.term = term;
  }

  setSeq(seq: number): void {
    this.seq = seq;
  }

  toJSON(): any {
    return {
      commandName: this.commandName,
      arg: this.arg,
      reqTurn: this.reqTurn,
    };
  }

  static fromJSON(data: any): LastTurn {
    return new LastTurn(
      data.commandName,
      data.arg,
      data.reqTurn
    );
  }

  clone(): LastTurn {
    return new LastTurn(
      this.commandName,
      this.arg ? JSON.parse(JSON.stringify(this.arg)) : null,
      this.reqTurn
    );
  }

  equals(other: LastTurn): boolean {
    return (
      this.commandName === other.commandName &&
      JSON.stringify(this.arg) === JSON.stringify(other.arg) &&
      this.reqTurn === other.reqTurn
    );
  }

  toString(): string {
    return `LastTurn(${this.commandName}, ${JSON.stringify(this.arg)}, ${this.reqTurn})`;
  }
}
