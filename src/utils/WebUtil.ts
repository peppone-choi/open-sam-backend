/**
 * WebUtil - PHP WebUtil 클래스 변환
 * Express.js 환경에 맞게 조정된 웹 유틸리티
 */

import { Request, Response } from 'express';
import { TimeUtil } from './TimeUtil';
import { Json } from './Json';
import { Util } from './Util';

export class APICacheResult {
  constructor(
    public lastModified: Date | null = null,
    public etag: string | null = null,
    public validSeconds: number = 60,
    public isPublic: boolean = false
  ) {}
}

export class WebUtil {
  private constructor() {}

  /**
   * IPv4 이스케이프
   */
  static escapeIPv4(ip: string): string {
    return ip.replace(/\./g, '\\.');
  }

  /**
   * 상대 경로 해석
   */
  static resolveRelativePath(path: string, basepath: string): string {
    try {
      const url = new URL(path, basepath);
      return url.toString();
    } catch {
      // 상대 경로 처리
      const base = basepath.endsWith('/') ? basepath : basepath + '/';
      return base + path.replace(/^\//, '');
    }
  }

  /**
   * No-Cache 헤더 설정
   */
  static setHeaderNoCache(res: Response): void {
    res.setHeader('Expires', 'Wed, 01 Jan 2014 00:00:00 GMT');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }

  /**
   * AJAX 요청 확인
   */
  static isAJAX(req: Request): boolean {
    const header = req.headers['x-requested-with'];
    return header?.toString().toLowerCase() === 'xmlhttprequest';
  }

  /**
   * 캐시 헤더 설정
   */
  static setCacheHeader(res: Response, cache: APICacheResult | null): void {
    if (!cache) {
      return;
    }

    const control = cache.isPublic ? 'public' : 'private';
    res.removeHeader('expires');
    res.setHeader('Cache-Control', `${control}, max-age=${cache.validSeconds}`);
    res.setHeader('Pragma', 'cache');

    if (cache.etag !== null) {
      res.setHeader('ETag', `"${cache.etag}"`);
    }

    if (cache.lastModified !== null) {
      const lastModifiedUnixTime = Math.floor(cache.lastModified.getTime() / 1000);
      const lastModified = new Date(lastModifiedUnixTime * 1000).toUTCString();
      res.setHeader('Last-Modified', lastModified);
    }
  }

  /**
   * 304 Not Modified 응답
   */
  static dieWithNotModified(res: Response): void {
    res.status(304).end();
  }

  /**
   * ETag 파싱
   */
  static parseETag(req: Request): string | null {
    const etag = req.headers['if-none-match'];
    if (!etag) {
      return null;
    }

    const etagStr = etag.toString().trim();
    if (etagStr.startsWith('W/"') && etagStr.endsWith('"')) {
      return etagStr.substring(3, etagStr.length - 1);
    }
    if (etagStr.startsWith('"') && etagStr.endsWith('"')) {
      return etagStr.substring(1, etagStr.length - 1);
    }
    return etagStr;
  }

  /**
   * Last-Modified 파싱
   */
  static parseLastModified(req: Request): Date | null {
    const modifiedSinceStr = req.headers['if-modified-since'];
    if (!modifiedSinceStr) {
      return null;
    }

    try {
      return new Date(modifiedSinceStr.toString());
    } catch {
      return null;
    }
  }

  /**
   * AJAX 요청 필수
   */
  static requireAJAX(req: Request, res: Response): void {
    if (!this.isAJAX(req)) {
      res.status(400).json({
        result: false,
        reason: 'no ajax'
      });
    }
  }

  /**
   * JSON POST 파싱 (Express.js에서는 이미 파싱됨)
   */
  static parseJsonPost(req: Request): any {
    if (req.method !== 'POST') {
      throw new Error('Request method must be POST!');
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('Content type must be: application/json');
    }

    // Express.js에서는 body-parser가 이미 파싱함
    if (!req.body || typeof req.body !== 'object') {
      throw new Error('Invalid JSON body');
    }

    return req.body;
  }

  /**
   * 정적 값 출력 (HTML 생성)
   */
  static printStaticValues(values: Record<string, any>, pretty: boolean = true): string {
    if (Object.keys(values).length === 0) {
      return '';
    }

    const lines: string[] = ['<script>'];

    for (const [key, value] of Object.entries(values)) {
      const flag = Json.EMPTY_ARRAY_IS_DICT | (pretty ? Json.PRETTY : 0);
      lines.push(`var ${key} = ${Json.encode(value, flag)};`);
    }

    lines.push('</script>\n');
    return lines.join('\n');
  }

  /**
   * HTML 정제 (간단한 버전)
   */
  static htmlPurify(text: string | null): string {
    if (!text) {
      return '';
    }

    // 기본적인 HTML 태그 제거 및 이스케이프
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * 에러 백 메시지 (HTML)
   */
  static errorBackMsg(msg: string, target: string | null = null): string {
    const jmsg = Json.encode(msg);
    const moveNext = target ? `location.replace('${target}');` : 'history.go(-1);';

    return `<html><head><style>html,body{background:black;}</style><script>alert(${jmsg});${moveNext}</script></head><body></body></html>`;
  }

  /**
   * 메뉴 그리기
   */
  static drawMenu(menuItems: Array<[string, string] | [string, string, string]>): string {
    const result: string[] = [];

    for (const menuItem of menuItems) {
      if (menuItem.length === 2) {
        const [url, title] = menuItem;
        const targetAttr = '';
        const escapedTitle = title.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        const escapedUrl = url.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        result.push(`<a class='nav-link' href='${escapedUrl}' ${targetAttr}>${escapedTitle}</a>`);
      } else {
        const [url, title, target] = menuItem;
        const escapedTarget = target.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        const targetAttr = `target='${escapedTarget}' `;
        const escapedTitle = title.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        const escapedUrl = url.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
        result.push(`<a class='nav-link' href='${escapedUrl}' ${targetAttr}>${escapedTitle}</a>`);
      }
    }

    return result.join('\n');
  }

  /**
   * 도메인 교체
   */
  static replaceDomain(origPath: string, req: Request): string {
    try {
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      return new URL(origPath, baseUrl).toString();
    } catch {
      return origPath;
    }
  }
}



