/**
 * Setting - 서버 설정 관리
 * NOTE: 프로젝트 구조에 맞게 재설계 필요
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileTail } from './FileTail';
import { Json } from './Json';
import { Util } from './Util';
import { WebUtil } from './WebUtil';
import { NotImplementedException } from '../common/exceptions';

export class Setting {
  private basepath: string;
  private settingFile: string;
  private htaccessFile: string;
  private versionFile: string;
  private exist: boolean = false;
  private running: boolean = false;
  private shortName: string;
  private korName: string;
  private color: string;
  private version: string | null = null;

  constructor(basepath: string, korName: string, color: string, name?: string | null) {
    this.basepath = basepath;
    this.settingFile = path.resolve(basepath, 'd_setting', 'DB.php');
    this.htaccessFile = path.resolve(basepath, '.htaccess');
    this.versionFile = path.resolve(basepath, 'd_setting', 'VersionGit.php');

    this.korName = korName;
    this.color = color;
    this.shortName = name || path.basename(this.basepath);

    if (fs.existsSync(this.settingFile)) {
      this.exist = true;
      if (!fs.existsSync(this.htaccessFile)) {
        this.running = true;
      }
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  isExists(): boolean {
    return this.exist;
  }

  getShortName(): string {
    return this.shortName;
  }

  getColor(): string {
    return this.color;
  }

  getKorName(): string {
    return this.korName;
  }

  getBasePath(): string {
    return this.basepath;
  }

  getSettingFile(): string {
    return this.settingFile;
  }

  getVersion(): string {
    if (this.version !== null) {
      return this.version;
    }

    if (!fs.existsSync(this.versionFile)) {
      this.version = 'noVersionFile';
      return this.version;
    }

    const tail = new FileTail(this.versionFile);
    let version = 'noVersionJson';
    
    for (const line of tail.smart(5, 100, true)) {
      if (line.trim().startsWith('//{')) {
        const jsonStr = line.substring(2);
        const versionObj = Json.decode(jsonStr);
        version = versionObj?.version || 'noVersionValue';
        break;
      }
    }
    
    this.version = version;
    return version;
  }

  closeServer(): boolean {
    if (!fs.existsSync(this.basepath) || !fs.statSync(this.basepath).isDirectory()) {
      return false;
    }

    // TODO: .htaccess 템플릿 렌더링 구현
    // 현재는 Node.js 환경이므로 .htaccess 대신 다른 방법 사용 필요
    
    return true;
  }

  openServer(): boolean {
    if (!fs.existsSync(this.basepath) || !fs.statSync(this.basepath).isDirectory()) {
      return false;
    }

    if (fs.existsSync(this.htaccessFile)) {
      fs.unlinkSync(this.htaccessFile);
    }

    return true;
  }

  getDetailStatus(): { game: any; me: any } {
    if (!this.isRunning()) {
      return {
        game: null,
        me: null,
      };
    }
    throw new NotImplementedException();
  }
}



