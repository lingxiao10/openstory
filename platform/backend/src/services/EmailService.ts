import { config } from '../config';

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const { apiKey, from } = config.resend;
  if (!apiKey) throw new Error('邮件服务未配置 / Email service not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'OpenStory 注册验证码 / Verification Code',
      html: `<p>您的验证码为 / Your verification code is: <strong style="font-size:24px">${code}</strong></p><p>有效期 5 分钟 / Valid for 5 minutes.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`发送邮件失败 / Email send failed: ${body}`);
  }
}
