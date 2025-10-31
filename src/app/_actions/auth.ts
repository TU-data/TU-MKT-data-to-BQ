'use server';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, getExpectedSessionValue, resolveAppPassword } from '@/lib/auth';

export type AuthState = {
  error?: string;
  success: boolean;
};

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get('password');
  const expectedPassword = resolveAppPassword();

  if (!expectedPassword) {
    return {
      error: '서버에 APP_LOGIN_PASSWORD 환경 변수가 설정되어 있지 않습니다.',
      success: false,
    };
  }

  if (typeof password !== 'string' || password.length === 0) {
    return {
      error: '비밀번호를 입력해주세요.',
      success: false,
    };
  }

  if (password !== expectedPassword) {
    return {
      error: '비밀번호가 올바르지 않습니다.',
      success: false,
    };
  }

  const sessionValue = getExpectedSessionValue();

  if (!sessionValue) {
    return {
      error: '세션을 생성할 수 없습니다. 관리자에게 문의해주세요.',
      success: false,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
