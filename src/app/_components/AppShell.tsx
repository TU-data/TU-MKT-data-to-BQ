'use client';

import { useMemo, useRef, useState, ChangeEvent, DragEvent, useTransition } from 'react';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoggingOut, startLogout] = useTransition();
  const router = useRouter();

  const handleDatasetClick = (datasetId: DatasetWithSchema['id']) => {
    setSelectedDatasetId(datasetId);
    setLogs(['새로운 CSV 업로드를 준비하고 있습니다.']);
    setError(null);
    setSelectedFile(null);
  };

  const handleUploadClick = () => {
    if (isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) {
      return;
    }

    selectFile(files);
  };

  const selectFile = (fileList: FileList) => {
    if (fileList.length > 1) {
      setError('한 번에 하나의 CSV 파일만 선택할 수 있습니다.');
      setSelectedFile(null);
      return;
    }

    const [file] = Array.from(fileList);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('CSV 파일만 업로드할 수 있습니다.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setLogs([`${file.name} 파일이 선택되었습니다. 업로드 버튼을 눌러 진행해주세요.`]);
  };

  const handleLogout = () => {
    startLogout(async () => {
      await logoutAction();
      router.refresh();
    });
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isUploading) {
      return;
    }
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (isUploading) {
      return;
    }

    const files = event.dataTransfer?.files;
    if (!files?.length) {
      return;
    }

    selectFile(files);
  };

  const initiateUpload = async () => {
    if (!selectedDataset || !selectedFile || isUploading) {
      return;
    }

    const confirmed = window.confirm(
      `업로드하면 수정할 수 없습니다.\n${selectedDataset.tableLabel}에 ${selectedFile.name} 파일을 업로드하시겠습니까?`
    );
    if (!confirmed) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setLogs([
      '파일 업로드를 시작합니다....',
      `${selectedDataset.label} 파일 구조를 확인하고 있습니다....`,
    ]);

    try {
      const uploadLogs = await uploadFile(selectedFile, selectedDataset.id);
      setLogs(uploadLogs.logs);
      if (!uploadLogs.success) {
        setError(uploadLogs.error ?? '업로드 과정에서 문제가 발생했습니다.');
      } else {
        setSelectedFile(null);
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
            <div
              className={
                isDragActive ? `${styles.uploadBox} ${styles.uploadBoxDragging}` : styles.uploadBox
              }
              role="button"
              tabIndex={0}
              onClick={handleUploadClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={styles.uploadIcon}>+</div>
              <div className={styles.uploadHint}>CSV 파일을 업로드 해주세요.</div>
              <div className={styles.uploadHelper}>
                {isUploading
                  ? '파일 전송 중입니다...'
                  : '클릭하거나 파일을 끌어다 놓아 선택할 수 있습니다.'}
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
            <div className={styles.selectedFileArea}>
              <span className={styles.selectedFileLabel}>선택된 파일</span>
              {selectedFile ? (
                <span className={styles.selectedFileValue}>
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </span>
              ) : (
                <span className={styles.selectedFilePlaceholder}>파일이 선택되지 않았습니다.</span>
              )}
            </div>
            <div className={styles.uploadActions}>
              <button
                type="button"
                className={styles.uploadButton}
                onClick={initiateUpload}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? '업로드 중...' : '업로드 실행'}
              </button>
            </div>
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, exponent);
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
