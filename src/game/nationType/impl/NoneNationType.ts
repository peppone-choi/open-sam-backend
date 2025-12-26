/**
 * 기본/중립 국가유형
 * PHP 대응: ActionNationType/None.php, che_중립.php
 */

import { BaseNationType } from '../BaseNationType';

export class NoneNationType extends BaseNationType {
  get id(): string {
    return 'None';
  }

  getName(): string {
    return '-';
  }

  getPros(): string {
    return '';
  }

  getCons(): string {
    return '';
  }
}
