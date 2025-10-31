import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import type { DatasetConfig } from "@/config/datasets";
import { SESSION_COOKIE_NAME, getExpectedSessionValue } from "@/lib/auth";
import { getDatasetWithSchema, SchemaField } from "@/lib/schema";
import { createBigQueryClient } from "@/lib/googleClient";

type UploadResult = {
  success: boolean;
  logs: string[];
  error?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const logMessages: string[] = [];
  const appendLog = (message: string) => {
    logMessages.push(message);
  };

  const authResult = await ensureAuthenticated();
  if (!authResult.authenticated) {
    appendLog("인증이 필요합니다. 다시 로그인해 주세요.");
    return NextResponse.json<UploadResult>(
      { success: false, logs: logMessages, error: authResult.error },
      { status: 401 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    appendLog("요청 본문을 읽을 수 없습니다.");
    return NextResponse.json<UploadResult>(
      { success: false, logs: logMessages, error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  const datasetIdValue = formData.get("datasetId");
  const file = formData.get("file");

  if (typeof datasetIdValue !== "string") {
    appendLog("데이터셋 정보가 누락되었습니다.");
    return NextResponse.json<UploadResult>(
      { success: false, logs: logMessages, error: "datasetId 필드가 필요합니다." },
      { status: 400 }
    );
  }

  if (!(file instanceof File)) {
    appendLog("CSV 파일이 전달되지 않았습니다.");
    return NextResponse.json<UploadResult>(
      { success: false, logs: logMessages, error: "file 필드에 CSV 파일을 첨부해주세요." },
      { status: 400 }
    );
  }

  const dataset = await getDatasetWithSchema(datasetIdValue as DatasetConfig["id"]);
  if (!dataset) {
    appendLog(`알 수 없는 데이터셋(${datasetIdValue}) 입니다.`);
    return NextResponse.json<UploadResult>(
      { success: false, logs: logMessages, error: "지원하지 않는 데이터셋입니다." },
      { status: 400 }
    );
  }

  appendLog("파일 업로드를 시작합니다....");
  appendLog(`${dataset.label} 파일 구조를 확인 하고 있습니다....`);

  let fileBuffer = Buffer.from(await file.arrayBuffer());

  appendLog("스키마 정의를 불러오고 있습니다....");
  const schemaFields = dataset.schema;
  const sourceColumns = schemaFields.map((field) => field.sourceName);

  const headerRow = parseHeader(fileBuffer);
  if (!headerRow) {
    appendLog("CSV 헤더를 분석할 수 없습니다.");
    return NextResponse.json<UploadResult>(
      {
        success: false,
        logs: logMessages,
        error: "CSV 파일 구조를 확인할 수 없습니다.",
      },
      { status: 400 }
    );
  }

  const missingFields = sourceColumns.filter((column) => !headerRow.includes(column));

  if (missingFields.length > 0) {
    appendLog("필수 컬럼이 누락되어 있습니다.");
    const missingList = missingFields.join(", ");
    return NextResponse.json<UploadResult>(
      {
        success: false,
        logs: logMessages,
        error: `필수 컬럼 누락: ${missingList}`,
      },
      { status: 400 }
    );
  }

  appendLog("업로드 파일을 BigQuery 스키마에 맞게 변환하고 있습니다....");
  const convertedBuffer = transformCsvToTargetSchema(fileBuffer, schemaFields, headerRow);

  appendLog("파일 구조를 완료하였습니다.....");
  appendLog("파일 업로드를 시작합니다.....");

  appendLog(`BigQuery 업로드 대상 테이블: ${dataset.bigQueryTableId}`);

  let datasetId: string;
  let tableId: string;
  let projectIdFromConfig: string | undefined;
  try {
    const parsed = parseBigQueryTableId(dataset.bigQueryTableId);
    datasetId = parsed.datasetId;
    tableId = parsed.tableId;
    projectIdFromConfig = parsed.projectId;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "BigQuery 테이블 ID를 해석할 수 없습니다.";
    appendLog(message);
    return NextResponse.json<UploadResult>(
      { success: false, logs: logMessages, error: message },
      { status: 500 }
    );
  }

  const tempFilePath = join(
    tmpdir(),
    `mkt-data-${dataset.id}-${Date.now()}-${Math.random().toString(16).slice(2)}.csv`
  );

  await fs.writeFile(tempFilePath, convertedBuffer, "utf8");

  try {
    appendLog("BigQuery 로드 작업을 시작합니다....");
    const { client: bigquery, projectId: resolvedProjectId } = createBigQueryClient(projectIdFromConfig);
    const table = bigquery.dataset(datasetId).table(tableId);

    const schemaFieldsForBigQuery = schemaFields.map((field) => ({
      name: field.targetName,
      type: field.dataType,
      mode: "NULLABLE" as const,
      description: "",
    }));

    await table.load(tempFilePath, {
      sourceFormat: "CSV",
      schema: {
        fields: schemaFieldsForBigQuery,
      },
      writeDisposition: "WRITE_APPEND",
      skipLeadingRows: 1,
      autodetect: false,
    });
    appendLog(
      `BigQuery의 ${resolvedProjectId}.${datasetId}.${tableId} 테이블에 업로드를 완료 했습니다.....`
    );
  } catch (error) {
    console.error(error);
    appendLog("BigQuery 업로드 중 오류가 발생했습니다.");
    return NextResponse.json<UploadResult>(
      {
        success: false,
        logs: logMessages,
        error:
          error instanceof Error
            ? error.message
            : "BigQuery 업로드 중 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  } finally {
    await fs.unlink(tempFilePath).catch(() => {
      appendLog("임시 파일 삭제 중 문제가 발생했으나 무시합니다.");
    });
    fileBuffer.fill(0);
    fileBuffer = Buffer.alloc(0);
  }

  appendLog("업로드한 CSV 파일을 서버에서 삭제합니다....");
  appendLog("모든 작업이 완료 되었습니다....");

  return NextResponse.json<UploadResult>(
    {
      success: true,
      logs: logMessages,
    },
    { status: 200 }
  );
}

async function ensureAuthenticated(): Promise<{ authenticated: boolean; error?: string }> {
  const expectedSession = getExpectedSessionValue();
  if (!expectedSession) {
    return {
      authenticated: false,
      error: "APP_LOGIN_PASSWORD 환경 변수가 설정되어 있지 않습니다.",
    };
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || sessionCookie.value !== expectedSession) {
    return {
      authenticated: false,
      error: "인증이 만료되었습니다.",
    };
  }

  return { authenticated: true };
}

function parseHeader(buffer: Buffer): string[] | null {
  try {
    const rows = parse(buffer, {
      to_line: 1,
      skip_empty_lines: true,
      bom: true,
    }) as string[][];

    const header = rows.at(0);
    if (!header) {
      return null;
    }

    return header.map((value) => value.trim());
  } catch (error) {
    console.error("CSV header parse error", error);
    return null;
  }
}

function transformCsvToTargetSchema(
  buffer: Buffer,
  schema: SchemaField[],
  headerRow: string[]
): string {
  const records = parse(buffer, {
    bom: true,
    columns: headerRow,
    from_line: 2,
    skip_empty_lines: true,
  }) as Record<string, unknown>[];

  const mappedRecords = records.map((record) => {
    const row: Record<string, unknown> = {};
    schema.forEach((field) => {
      row[field.targetName] = record[field.sourceName] ?? "";
    });
    return row;
  });

  const englishColumns = schema.map((field) => field.targetName);
  return stringify(mappedRecords, {
    header: true,
    columns: englishColumns,
  });
}

function parseBigQueryTableId(tableId: string): {
  projectId?: string;
  datasetId: string;
  tableId: string;
} {
  const parts = tableId.split(".");

  if (parts.length === 3) {
    const [projectId, datasetId, tblId] = parts;
    if (!projectId || !datasetId || !tblId) {
      throw new Error("BigQuery 테이블 ID 형식이 올바르지 않습니다. project.dataset.table 형태여야 합니다.");
    }
    return { projectId, datasetId, tableId: tblId };
  }

  if (parts.length === 2) {
    const [datasetId, tblId] = parts;
    if (!datasetId || !tblId) {
      throw new Error("BigQuery 테이블 ID 형식이 올바르지 않습니다. dataset.table 형태여야 합니다.");
    }
    return { datasetId, tableId: tblId };
  }

  throw new Error(
    "BigQuery 테이블 ID 형식이 올바르지 않습니다. project.dataset.table 또는 dataset.table 형태여야 합니다."
  );
}
