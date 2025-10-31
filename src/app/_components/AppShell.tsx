'use client';

import { useMemo, useRef, useState, ChangeEvent, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DatasetWithSchema } from '@/lib/schema';
import styles from './AppShell.module.css';
import { logoutAction } from '../_actions/auth';

type UploadResponse = {
  success: boolean;
  logs: string[];
  error?: string;
};

type AppShellProps = {
  datasets: DatasetWithSchema[];
};

export default function AppShell({ datasets }: AppShellProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<DatasetWithSchema['id']>(
    datasets[0]?.id ?? 'gangnamunni'
  );
  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId) ?? datasets[0],
    [datasets, selectedDatasetId]
  );

  const [logs, setLogs] = useState<string[]>([
    'CSV 파일을 업로드하면 진행 로그가 여기에 표시됩니다.',
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoggingOut, startLogout] = useTransition();
  const router = useRouter();

  const handleDatasetClick = (datasetId: DatasetWithSchema['id']) => {
    setSelectedDatasetId(datasetId);
    setLogs(['새로운 CSV 업로드를 준비하고 있습니다.']);
    setError(null);
  };

  const handleUploadClick = () => {
    if (isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !selectedDataset) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setLogs([
      '파일 업로드를 시작합니다....',
      `${selectedDataset.label} 파일 구조를 확인하고 있습니다....`,
    ]);

    try {
      const uploadLogs = await uploadFile(file, selectedDataset.id);
      setLogs(uploadLogs.logs);
      if (!uploadLogs.success) {
        setError(uploadLogs.error ?? '업로드 과정에서 문제가 발생했습니다.');
      }
    } catch (uploadError) {
      console.error(uploadError);
      setError('업로드 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setLogs([
        '파일 업로드를 시작합니다....',
        '서버와 통신하는 동안 오류가 발생했습니다.',
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
      router.refresh();
    });
  };

  if (!selectedDataset) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.brand}>Marketing Data Console</div>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </header>

      <div className={styles.content}>
        <div className={styles.datasetSelector}>
          {datasets.map((dataset) => {
            const active = dataset.id === selectedDatasetId;
            const buttonClass = active
              ? `${styles.datasetButton} ${styles.datasetButtonActive}`
              : styles.datasetButton;
            return (
              <button
                key={dataset.id}
                type="button"
                className={buttonClass}
                onClick={() => handleDatasetClick(dataset.id)}
                disabled={isUploading}
              >
                {dataset.label}
              </button>
            );
          })}
        </div>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>CSV 업로드</h2>
            <div className={styles.uploadBox} role="button" tabIndex={0} onClick={handleUploadClick}>
              <div className={styles.uploadIcon}>+</div>
              <div className={styles.uploadHint}>CSV 파일을 업로드 해주세요.</div>
              <div className={styles.uploadHelper}>
                {isUploading ? '파일 전송 중입니다...' : '클릭하여 파일 탐색기를 열 수 있습니다.'}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={handleFileChange}
              aria-hidden
            />
            <div className={styles.status}>
              {isUploading
                ? `${selectedDataset.label} 업로드 진행 중`
                : `${selectedDataset.label} 업로드 대기`}
            </div>
            <div className={styles.metadataList}>
              <span>· BigQuery Table ID: {selectedDataset.bigQueryTableId}</span>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>스키마 정보</h2>
            <div className={`${styles.schemaRow} ${styles.schemaRowHeader}`}>
              <span>기존 컬럼명</span>
              <span>데이터 타입</span>
              <span>영어 컬럼명</span>
            </div>
            <div className={styles.schemaList}>
              {selectedDataset.schema.map((field) => (
                <div key={field.targetName} className={styles.schemaRow}>
                  <span>{field.sourceName}</span>
                  <span>{field.dataType}</span>
                  <span>{field.targetName}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>진행 로그</h2>
          <div className={styles.logsArea}>{logs.join('\n')}</div>
        </section>
      </div>
    </div>
  );
}

async function uploadFile(file: File, datasetId: DatasetWithSchema['id']): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('datasetId', datasetId);
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    return {
      success: false,
      logs: ['파일 업로드 요청이 실패했습니다.'],
      error: `업로드 요청 실패 (HTTP ${response.status})`,
    };
  }

  const payload = (await response.json()) as UploadResponse;
  return payload;
}
