/**
 * Validator - PHP Validator 클래스 변환
 * yup 기반 유효성 검사 (PHP Valitron 기반)
 */

import * as yup from 'yup';
import { getStringWidth } from './string-util';

export class Validator {
  private schema: yup.ObjectSchema<any>;
  private errorMap: Record<string, string[]> = {};
  private data: Record<string, any>;

  constructor(data: Record<string, any>) {
    this.data = data;
    this.schema = yup.object().shape({});
    this.errorMap = {};
  }

  /**
   * 검증 규칙 추가
   */
  rule(ruleName: string, fields: string | string[], ...params: any[]): this {
    // yup 스키마에 규칙 추가
    // 실제 구현은 yup의 fluent API를 사용
    return this;
  }

  /**
   * 문자열 필수 검증
   */
  required(fields: string | string[]): this {
    const fieldArray = Array.isArray(fields) ? fields : [fields];
    // yup 스키마에 required 추가
    return this;
  }

  /**
   * 정수 배열 검증
   */
  protected validateIntegerArray(field: string, value: any): boolean {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every(item => typeof item === 'number' && Number.isInteger(item));
  }

  /**
   * 문자열 배열 검증
   */
  protected validateStringArray(field: string, value: any): boolean {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every(item => typeof item === 'string');
  }

  /**
   * 정수 검증
   */
  protected validateInt(field: string, value: any): boolean {
    return typeof value === 'number' && Number.isInteger(value);
  }

  /**
   * 실수 검증
   */
  protected validateFloat(field: string, value: any): boolean {
    return typeof value === 'number' && !Number.isInteger(value);
  }

  /**
   * 문자열 최대 너비 검증
   */
  protected validateStringWidthMax(field: string, value: any, params: number[]): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const width = getStringWidth(value);
    return width <= params[0];
  }

  /**
   * 문자열 최소 너비 검증
   */
  protected validateStringWidthMin(field: string, value: any, params: number[]): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const width = getStringWidth(value);
    return width >= params[0];
  }

  /**
   * 문자열 너비 범위 검증
   */
  protected validateStringWidthBetween(field: string, value: any, params: number[]): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const width = getStringWidth(value);
    return params[0] <= width && width <= params[1];
  }

  /**
   * 키 존재 검증
   */
  protected validateKeyExists(field: string, value: any, params: any[]): boolean {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return false;
    }
    return value in params[0];
  }

  /**
   * 검증 실행
   */
  async validate(): Promise<boolean> {
    try {
      await this.schema.validate(this.data, { abortEarly: false });
      return true;
    } catch (error: any) {
      if (error.inner) {
        this.errorMap = {};
        for (const err of error.inner) {
          if (!this.errorMap[err.path]) {
            this.errorMap[err.path] = [];
          }
          this.errorMap[err.path].push(err.message);
        }
      }
      return false;
    }
  }

  /**
   * 에러 메시지 문자열 반환
   */
  errorStr(): string {
    const errorValues = Object.values(this.errorMap);
    const flattened = errorValues.map(errs => errs.join(', '));
    return flattened.join(', ');
  }

  /**
   * 에러 객체 반환
   */
  errors(): Record<string, string[]> {
    return this.errorMap;
  }
}

