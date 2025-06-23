import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.setupEmailProvider();
  }

  private setupEmailProvider() {
    const emailService = this.configService.get('EMAIL_SERVICE', 'gmail');
    const emailUsername = this.configService.get('EMAIL_USERNAME');
    const emailPassword = this.configService.get('EMAIL_PASSWORD');

    this.logger.log(`📧 Setting up email service: ${emailService}`);
    this.logger.log(`📧 Email username: ${emailUsername}`);
    this.logger.log(`🔑 Password length: ${emailPassword?.length} characters`);

    switch (emailService.toLowerCase()) {
      case 'outlook':
      case 'hotmail':
        this.setupOutlook(emailUsername, emailPassword);
        break;
      case 'yahoo':
        this.setupYahoo(emailUsername, emailPassword);
        break;
      case 'ethereal':
        this.setupEthereal(emailUsername, emailPassword);
        break;
      case 'gmail':
      default:
        this.setupGmail(emailUsername, emailPassword);
        break;
    }
  }

  private setupOutlook(username: string, password: string) {
    this.transporter = nodemailer.createTransport({
      service: 'hotmail', // Works for both outlook.com and hotmail.com
      auth: {
        user: username,
        pass: password,
      },
    });
    this.verifyConnection('Outlook');
  }

  private setupYahoo(username: string, password: string) {
    this.transporter = nodemailer.createTransport({
      service: 'yahoo',
      auth: {
        user: username,
        pass: password, // Use App Password for Yahoo
      },
    });
    this.verifyConnection('Yahoo');
  }

  private setupEthereal(username: string, password: string) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: username,
        pass: password,
      },
    });
    this.verifyConnection('Ethereal (Test)');
  }

  private setupGmail(username: string, password: string) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: username,
        pass: password, // Use App Password for Gmail
      },
    });
    this.verifyConnection('Gmail');
  }

  private verifyConnection(serviceName: string) {
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(
          `❌ ${serviceName} SMTP connection failed:`,
          error.message,
        );
        this.logger.warn('💡 Troubleshooting tips:');
        if (serviceName === 'Gmail') {
          this.logger.warn(
            '   - Gmail: Generate App Password at https://myaccount.google.com/apppasswords',
          );
          this.logger.warn('   - Gmail: Login to Gmail in browser first');
        } else if (serviceName === 'Outlook') {
          this.logger.warn(
            '   - Outlook: Use regular password (no App Password needed)',
          );
          this.logger.warn('   - Outlook: Make sure account is active');
        } else if (serviceName === 'Yahoo') {
          this.logger.warn(
            '   - Yahoo: Generate App Password in Account Settings',
          );
        }
      } else {
        this.logger.log(
          `✅ ${serviceName} SMTP connection verified successfully`,
        );
      }
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: {
        name: 'Skinora Healthcare',
        address: this.configService.get('EMAIL_USERNAME'),
      },
      to: email,
      subject: '🌟 Xác Thực Email - Skinora Healthcare',
      html: this.createVerificationEmailTemplate(verificationUrl),
      text: `Vui lòng xác thực email tại: ${verificationUrl}`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Verification email sent to: ${email}`);
      this.logger.log(`🔗 Verification URL: ${verificationUrl}`);
      this.logger.log(`📧 Message ID: ${info.messageId}`);

      // Log preview URL for Ethereal
      if (info.getTestMessageUrl) {
        this.logger.log(`👀 Preview email: ${info.getTestMessageUrl(info)}`);
      }
    } catch (error) {
      this.logger.error('❌ Failed to send verification email:', error.message);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const mailOptions = {
      from: {
        name: 'Skinora Healthcare',
        address: this.configService.get('EMAIL_USERNAME'),
      },
      to: email,
      subject: '🎉 Chào mừng đến với Skinora Healthcare!',
      html: this.createWelcomeEmailTemplate(fullName),
      text: `Chào mừng ${fullName} đến với Skinora Healthcare!`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Welcome email sent to: ${email}`);
      this.logger.log(`📧 Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error('❌ Failed to send welcome email:', error.message);
      throw error;
    }
  }

  async saveEmailTemplatePreview(
    email: string,
    token: string,
    fullName?: string,
  ): Promise<void> {
    // This method is for saving email template preview
    // Can be used for debugging or testing purposes
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    const htmlContent = this.createVerificationEmailTemplate(verificationUrl);

    this.logger.log(`📧 Email template preview saved for: ${email}`);
    this.logger.log(`🔗 Verification URL: ${verificationUrl}`);
    if (fullName) {
      this.logger.log(`👤 Full name: ${fullName}`);
    }

    // Could save to file or database for preview
    // For now, just log the information
  }

  private createVerificationEmailTemplate(verificationUrl: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Xác Thực Email - Skinora</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <!-- Header với tông màu xanh lá y tế -->
        <div style="background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); padding: 40px 30px; text-align: center; border-radius: 15px 15px 0 0; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);">
            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏥 SKINORA</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; font-weight: 500;">Healthcare & Skincare Solution</p>
        </div>
        
        <div style="background: white; padding: 50px 40px; border-radius: 0 0 15px 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
            <!-- Icon container với flex để căn giữa đúng cách -->
            <div style="text-align: center; margin-bottom: 40px;">
                <div style="background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4);">
                    <span style="font-size: 45px; line-height: 1;">📧</span>
                </div>
                <h2 style="color: #27AE60; margin: 0; font-size: 24px; font-weight: bold;">Xác Thực Email Của Bạn</h2>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
                <p style="font-size: 18px; margin-bottom: 15px; color: #2C3E50;">Chào mừng bạn đến với <strong style="color: #27AE60;">Skinora Healthcare</strong>! 🎉</p>
                <p style="font-size: 16px; margin-bottom: 0; color: #666;">Vui lòng click vào nút bên dưới để xác thực email của bạn:</p>
            </div>
            
            <!-- Button với hiệu ứng hover -->
            <div style="text-align: center; margin: 50px 0;">
                <a href="${verificationUrl}" 
                   style="display: inline-block; padding: 18px 45px; background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4); transition: all 0.3s ease;">
                    🔐 Xác Thực Email Ngay
                </a>
            </div>
            
            <!-- Thông tin bảo mật với màu xanh lá -->
            <div style="background: linear-gradient(135deg, #E8F8F5 0%, #D5F4E6 100%); border-left: 5px solid #27AE60; padding: 25px; margin: 40px 0; border-radius: 8px;">
                <h3 style="color: #27AE60; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
                    <span style="margin-right: 10px;">🛡️</span>Lưu Ý Bảo Mật
                </h3>
                <ul style="margin: 0; padding-left: 25px; color: #2C3E50; line-height: 1.8;">
                    <li>Link này chỉ có hiệu lực trong <strong>24 giờ</strong></li>
                    <li>Nếu bạn không đăng ký, hãy bỏ qua email này</li>
                    <li>Không chia sẻ link này với ai khác</li>
                    <li>Liên hệ hỗ trợ nếu có thắc mắc</li>
                </ul>
            </div>
            
            <!-- Benefits section -->
            <div style="background: #F8F9FA; padding: 25px; border-radius: 8px; margin: 30px 0;">
                <h3 style="color: #27AE60; margin: 0 0 15px 0; font-size: 18px; text-align: center;">🌟 Những gì đang chờ bạn</h3>
                <div style="display: flex; flex-wrap: wrap; justify-content: space-around; text-align: center;">
                    <div style="flex: 1; min-width: 120px; margin: 10px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🔬</div>
                        <p style="font-size: 14px; color: #666; margin: 0;">Phân tích da AI</p>
                    </div>
                    <div style="flex: 1; min-width: 120px; margin: 10px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">👨‍⚕️</div>
                        <p style="font-size: 14px; color: #666; margin: 0;">Tư vấn bác sĩ</p>
                    </div>
                    <div style="flex: 1; min-width: 120px; margin: 10px;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
                        <p style="font-size: 14px; color: #666; margin: 0;">Theo dõi tiến độ</p>
                    </div>
                </div>
            </div>
            
            <p style="text-align: center; color: #7F8C8D; font-style: italic; font-size: 16px; margin-top: 30px;">
                Cảm ơn bạn đã tin tưởng Skinora Healthcare! 💚
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 30px 20px; color: #95A5A6; font-size: 14px; background: #ECF0F1; border-radius: 0 0 15px 15px;">
            <p style="margin: 0 0 8px 0;"><strong style="color: #27AE60;">Skinora Healthcare</strong> - Giải pháp chăm sóc da toàn diện</p>
            <p style="margin: 0; font-size: 12px;">© 2025 Skinora Healthcare. All rights reserved.</p>
            <div style="margin-top: 15px;">
                <span style="margin: 0 10px; color: #27AE60;">📧</span>
                <span style="margin: 0 10px; color: #27AE60;">📱</span>
                <span style="margin: 0 10px; color: #27AE60;">🌐</span>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private createWelcomeEmailTemplate(fullName: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Chào mừng - Skinora</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <!-- Header với tông màu xanh lá y tế -->
        <div style="background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); padding: 40px 30px; text-align: center; border-radius: 15px 15px 0 0; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);">
            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏥 SKINORA</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; font-weight: 500;">Healthcare & Skincare Solution</p>
        </div>
        
        <div style="background: white; padding: 50px 40px; border-radius: 0 0 15px 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
            <!-- Welcome icon -->
            <div style="text-align: center; margin-bottom: 40px;">
                <div style="background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4);">
                    <span style="font-size: 45px; line-height: 1;">🎉</span>
                </div>
                <h2 style="color: #27AE60; margin: 0; font-size: 26px; font-weight: bold;">Chào mừng ${fullName}!</h2>
            </div>
            
            <div style="text-align: center; margin-bottom: 40px;">
                <p style="font-size: 18px; margin-bottom: 15px; color: #2C3E50;">
                    Cảm ơn bạn đã tham gia cộng đồng <strong style="color: #27AE60;">Skinora Healthcare</strong>! 💚
                </p>
                <p style="font-size: 16px; color: #666;">
                    Tài khoản của bạn đã được xác thực thành công. Hãy khám phá những tính năng tuyệt vời!
                </p>
            </div>
            
            <!-- Features grid -->
            <div style="background: linear-gradient(135deg, #E8F8F5 0%, #D5F4E6 100%); border-left: 5px solid #27AE60; padding: 30px; margin: 40px 0; border-radius: 8px;">
                <h3 style="color: #27AE60; margin: 0 0 25px 0; font-size: 20px; text-align: center; display: flex; align-items: center; justify-content: center;">
                    <span style="margin-right: 10px;">🎯</span>Những gì bạn có thể làm
                </h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 30px; margin-bottom: 10px;">🔬</div>
                        <h4 style="color: #27AE60; margin: 0 0 8px 0; font-size: 16px;">Phân tích da AI</h4>
                        <p style="color: #666; margin: 0; font-size: 14px;">Công nghệ AI tiên tiến</p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 30px; margin-bottom: 10px;">👨‍⚕️</div>
                        <h4 style="color: #27AE60; margin: 0 0 8px 0; font-size: 16px;">Tư vấn bác sĩ</h4>
                        <p style="color: #666; margin: 0; font-size: 14px;">Chuyên gia da liễu</p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 30px; margin-bottom: 10px;">📊</div>
                        <h4 style="color: #27AE60; margin: 0 0 8px 0; font-size: 16px;">Theo dõi tiến độ</h4>
                        <p style="color: #666; margin: 0; font-size: 14px;">Lịch sử chăm sóc</p>
                    </div>
                    
                    <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <div style="font-size: 30px; margin-bottom: 10px;">🛒</div>
                        <h4 style="color: #27AE60; margin: 0 0 8px 0; font-size: 16px;">Mua sắm</h4>
                        <p style="color: #666; margin: 0; font-size: 14px;">Sản phẩm chất lượng</p>
                    </div>
                </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${this.configService.get('FRONTEND_URL', 'https://skinora.vercel.app')}" 
                   style="display: inline-block; padding: 18px 45px; background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); color: white; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4);">
                    🚀 Bắt Đầu Ngay
                </a>
            </div>
            
            <p style="text-align: center; color: #7F8C8D; font-style: italic; font-size: 16px; margin-top: 30px;">
                Chúc bạn có trải nghiệm tuyệt vời với Skinora! 💚
            </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 30px 20px; color: #95A5A6; font-size: 14px; background: #ECF0F1; border-radius: 0 0 15px 15px;">
            <p style="margin: 0 0 8px 0;"><strong style="color: #27AE60;">Skinora Healthcare</strong> - Giải pháp chăm sóc da toàn diện</p>
            <p style="margin: 0; font-size: 12px;">© 2025 Skinora Healthcare. All rights reserved.</p>
            <div style="margin-top: 15px;">
                <span style="margin: 0 10px; color: #27AE60;">📧</span>
                <span style="margin: 0 10px; color: #27AE60;">📱</span>
                <span style="margin: 0 10px; color: #27AE60;">🌐</span>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}
