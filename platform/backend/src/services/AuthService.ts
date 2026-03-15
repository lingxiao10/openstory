import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/UserModel';
import { config } from '../config';
import { AuthPayload } from '../types';
import { sendVerificationCode } from './EmailService';

// in-memory code store: email → { code, expiresAt }
const codeStore = new Map<string, { code: string; expiresAt: number }>();

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class AuthService {
  static async sendCode(email: string): Promise<void> {
    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail) throw new Error('邮箱已被注册 / Email already registered');

    const code = generateCode();
    codeStore.set(email, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
    await sendVerificationCode(email, code);
  }

  static async register(username: string, email: string, password: string, lang: 'zh' | 'en' = 'zh', code?: string) {
    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail) throw new Error('邮箱已被注册 / Email already registered');

    if (config.needCheckEmail) {
      if (!code) throw new Error('请输入验证码 / Verification code required');
      const entry = codeStore.get(email);
      if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
        throw new Error('验证码无效或已过期 / Invalid or expired code');
      }
      codeStore.delete(email);
    }

    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) throw new Error('用户名已存在 / Username already taken');

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await UserModel.create({ id, username, email, password_hash, lang });

    return {
      token: this.generateToken({ userId: id, username }),
      user: { id, username, email, lang },
    };
  }

  static async login(email: string, password: string) {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('用户不存在 / User not found');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('密码错误 / Incorrect password');

    return {
      token: this.generateToken({ userId: user.id, username: user.username }),
      user: { id: user.id, username: user.username, email: user.email, lang: user.lang },
    };
  }

  static async getUserById(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) return null;
    return { id: user.id, username: user.username, email: user.email, lang: user.lang };
  }

  static generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as any);
  }

  static verifyToken(token: string): AuthPayload {
    return jwt.verify(token, config.jwtSecret) as AuthPayload;
  }
}
