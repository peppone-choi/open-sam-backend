/**
 * KakaoUtil - 카카오 API 유틸리티
 * NOTE: 카카오 API SDK 필요
 */

import { Json } from './Json';
import { TimeUtil } from './TimeUtil';
import { Util } from './Util';

export class KakaoUtil {
  private constructor() {
    // static only
  }

  /**
   * 사용자명 중복 확인
   */
  static checkUsernameDup(username: string): string | true {
    if (!username) {
      return '계정명을 입력해주세요';
    }

    const usernameLower = username.toLowerCase();
    const length = usernameLower.length;
    
    if (length < 4 || length > 64) {
      return '적절하지 않은 길이입니다.';
    }

    // TODO: 데이터베이스 쿼리 구현
    // const cnt = RootDB::db()->queryFirstField('SELECT count(no) FROM member WHERE `id` = %s LIMIT 1', usernameLower);
    // if (cnt != 0) {
    //   return '이미 사용중인 계정명입니다';
    // }
    
    return true;
  }

  /**
   * 닉네임 중복 확인
   */
  static checkNicknameDup(nickname: string): string | true {
    if (!nickname) {
      return '닉네임을 입력해주세요';
    }

    // TODO: getStringWidth 함수 사용
    // const length = getStringWidth(nickname);
    const length = nickname.length; // 임시
    
    if (length < 1 || length > 18) {
      return '적절하지 않은 길이입니다.';
    }

    // TODO: 데이터베이스 쿼리 구현
    return true;
  }

  /**
   * 이메일 중복 확인
   */
  static checkEmailDup(email: string): string | true {
    if (!email) {
      return '이메일을 입력해주세요';
    }

    const length = email.length;
    if (length < 1 || length > 64) {
      return '적절하지 않은 길이입니다.';
    }

    // TODO: 데이터베이스 쿼리 구현
    return true;
  }

  /**
   * 사용자 번호로 OTP 생성
   */
  static createOTPbyUserNO(userNo: number): boolean {
    // TODO: 데이터베이스 쿼리 및 OTP 생성 구현
    return false;
  }

  /**
   * OTP 생성
   */
  static createOTP(accessToken: string): [number, number] | null {
    // TODO: 카카오 API SDK 사용하여 OTP 생성
    return null;
  }

  /**
   * 카카오 OAuth 확인
   */
  static kakaoOAuthCheck(userInfo: Record<string, any>): [boolean, string] | null {
    // TODO: 카카오 OAuth 검증 구현
    return null;
  }
}



