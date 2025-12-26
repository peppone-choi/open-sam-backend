import nodemailer from 'nodemailer';
import { logger } from '../common/logger';
import { configManager } from '../config/ConfigManager';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: configManager.get().email.smtp.host,
    port: configManager.get().email.smtp.port,
    secure: configManager.get().email.smtp.secure,
    auth: {
      user: configManager.get().email.smtp.user,
      pass: configManager.get().email.smtp.pass,
    },
  });

  /**
   * OTP 이메일 발송
   */
  static async sendOtp(to: string, code: string): Promise<boolean> {
    try {
      const { user, pass, host } = configManager.get().email.smtp;
      if (!user || !pass) {
        logger.warn('SMTP 설정이 없어 이메일을 발송하지 못했습니다.');
        return false;
      }

      // Gmail의 경우 ID만 입력했을 때를 대비해 주소 형식 보정
      let fromEmail = user;
      if (!fromEmail.includes('@') && host.includes('gmail')) {
        fromEmail = `${user}@gmail.com`;
      }

      const mailOptions = {
        from: `"OpenSAM" <${fromEmail}>`,
        to,
        subject: '[OpenSAM] 로그인 인증 코드',
        text: `로그인 인증 코드는 [${code}] 입니다.\n3분 내에 입력해주세요.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2>OpenSAM 로그인 인증</h2>
            <p>안녕하세요,</p>
            <p>로그인을 위한 인증 코드를 보내드립니다.</p>
            <h1 style="color: #4CAF50; letter-spacing: 5px;">${code}</h1>
            <p>이 코드는 3분간 유효합니다.</p>
            <hr>
            <p style="font-size: 12px; color: #888;">본 메일은 발신 전용입니다.</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`OTP Email sent to ${to}`);
      return true;
    } catch (error) {
      logger.error('Failed to send OTP email', error);
      return false;
    }
  }
}
