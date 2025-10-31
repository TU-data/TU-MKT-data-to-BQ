'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { AuthState, loginAction } from '../_actions/auth';
import styles from './LoginForm.module.css';

const initialState: AuthState = { success: false };

type LoginFormProps = {
  passwordConfigured: boolean;
};

export default function LoginForm({ passwordConfigured }: LoginFormProps) {
  const router = useRouter();
  const [state, formAction] = useFormState(loginAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Marketing Data Console</h1>
        <p className={styles.subtitle}>접근을 위해 운영팀 전용 비밀번호를 입력해주세요.</p>
        <form className={styles.form} action={formAction}>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className={styles.input}
            placeholder="비밀번호"
            disabled={!passwordConfigured}
          />
          {state.error ? <div className={styles.error}>{state.error}</div> : null}
          <SubmitButton disabled={!passwordConfigured} />
        </form>
        {!passwordConfigured ? (
          <p className={styles.notice}>
            APP_LOGIN_PASSWORD 환경 변수를 설정하고 빌드 또는 재시작을 진행해주세요.
          </p>
        ) : (
          <p className={styles.notice}>Vercel 환경 변수에서 비밀번호를 관리하고 변경할 수 있습니다.</p>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.submit} disabled={disabled || pending}>
      {pending ? '확인 중...' : '로그인'}
    </button>
  );
}
