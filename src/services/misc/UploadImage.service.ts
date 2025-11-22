import { sessionRepository } from '../../repositories/session.repository';
import { KVStorage } from '../../models/kv-storage.model';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';

/**
 * UploadImage 서비스
 * 이미지 업로드 및 저장
 * PHP: /sam/hwe/sammo/API/Misc/UploadImage.php
 */
export class UploadImageService {
  private static readonly MAX_SIZE = 1024 * 1024;
  private static readonly VALID_EXTENSIONS = ['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif'];

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const imageData = data.imageData;
    
    try {
      if (!imageData) {
        return {
          success: false,
          message: '이미지 데이터가 필요합니다.'
        };
      }


      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다'
        };
      }

      const buffer = Buffer.from(imageData, 'base64');
      if (!buffer || buffer.length === 0) {
        return {
          success: false,
          message: '올바른 데이터가 아닙니다'
        };
      }

      if (buffer.length > this.MAX_SIZE) {
        return {
          success: false,
          message: '이미지 크기가 1MB보다 큽니다'
        };
      }

      const signature = buffer.slice(0, 12);
      let extension = '';
      
      if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
        extension = 'png';
      } else if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
        extension = 'jpeg';
      } else if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46) {
        extension = 'gif';
      } else if (
        signature[0] === 0x52 && signature[1] === 0x49 && 
        signature[2] === 0x46 && signature[3] === 0x46 &&
        signature[8] === 0x57 && signature[9] === 0x45 &&
        signature[10] === 0x42 && signature[11] === 0x50
      ) {
        extension = 'webp';
      } else {
        return {
          success: false,
          message: '이미지 파일이 아닙니다'
        };
      }

      if (!this.VALID_EXTENSIONS.includes(extension.toLowerCase())) {
        return {
          success: false,
          message: `지원하지 않는 이미지 파일입니다: ${extension}`
        };
      }

      const hash = crypto.createHash('md5').update(buffer).digest('hex');
      const imgFullName = `${hash}.${extension}`;

      const uploadDir = path.join(process.cwd(), 'public', 'uploaded_image');
      const destPath = path.join(uploadDir, imgFullName);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      if (!fs.existsSync(uploadDir) || !fs.statSync(uploadDir).isDirectory()) {
        return {
          success: false,
          message: '버그! 업로드 경로 확인!'
        };
      }

      try {
        fs.accessSync(uploadDir, fs.constants.W_OK);
      } catch (err) {
        return {
          success: false,
          message: '버그! 업로드 권한 확인!'
        };
      }

      if (!fs.existsSync(destPath)) {
        try {
          fs.writeFileSync(destPath, buffer);
        } catch (err) {
          return {
            success: false,
            message: '업로드에 실패했습니다!'
          };
        }
      }

      const imgKey = `${sessionId}:${userId}`;
      
      const existingStorage = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        storage_id: 'img_storage'
      });

      if (existingStorage) {
        const storedStatus = (existingStorage.data && existingStorage.data[imgFullName]) || {};
        if (!storedStatus[imgKey]) {
          storedStatus[imgKey] = new Date();
          await kvStorageRepository.updateOneByFilter(
            {
              session_id: sessionId,
              storage_id: 'img_storage'
            },
            {
              $set: {
                [`data.${imgFullName}`]: storedStatus
              }
            }
          );
        }
      } else {
        const newData: Record<string, any> = {};
        newData[imgFullName] = {
          [imgKey]: new Date()
        };
        
        await kvStorageRepository.create({
          session_id: sessionId,
          storage_id: 'img_storage',
          data: newData
        });
      }

      return {
        success: true,
        result: true,
        path: `/uploaded_image/${imgFullName}`
      };
    } catch (error: any) {
      console.error('UploadImage 오류:', error);
      return {
        success: false,
        message: error.message || '알 수 없는 오류가 발생했습니다'
      };
    }
  }
}
