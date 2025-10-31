import { BigQuery, BigQueryOptions } from "@google-cloud/bigquery";

type BigQueryClientResult = {
  client: BigQuery;
  projectId: string;
};

type ServiceAccountJSON = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
};

export function createBigQueryClient(preferredProjectId?: string): BigQueryClientResult {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const envProjectId =
    process.env.BIGQUERY_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCP_PROJECT_ID;

  const resolvedProjectId = preferredProjectId ?? extractProjectIdFromJson(serviceAccountJson) ?? envProjectId;

  if (!resolvedProjectId) {
    throw new Error(
      "BigQuery 프로젝트 ID를 확인할 수 없습니다. 환경 변수(GOOGLE_APPLICATION_CREDENTIALS_JSON 또는 BIGQUERY_PROJECT_ID)에 프로젝트 정보를 설정해주세요."
    );
  }

  const options: BigQueryOptions = {
    projectId: resolvedProjectId,
  };

  if (serviceAccountJson) {
    const parsed = parseServiceAccountJson(serviceAccountJson);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS_JSON에 client_email 또는 private_key가 없습니다."
      );
    }
    options.credentials = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }

  return {
    client: new BigQuery(options),
    projectId: resolvedProjectId,
  };
}

function parseServiceAccountJson(jsonString: string): ServiceAccountJSON {
  const parsed = tryParseServiceAccountJSON(jsonString);
  if (!parsed) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON 값을 JSON으로 파싱하지 못했습니다. 문자열이 올바른 JSON이거나 base64 인코딩된 JSON인지 확인해주세요."
    );
  }
  return parsed;
}

function extractProjectIdFromJson(jsonString?: string): string | undefined {
  if (!jsonString) {
    return undefined;
  }

  const parsed = tryParseServiceAccountJSON(jsonString);
  return parsed?.project_id;
}

function tryParseServiceAccountJSON(jsonValue: string): ServiceAccountJSON | undefined {
  const directParse = safeJsonParse(jsonValue);
  if (directParse) {
    return directParse;
  }

  const maybeBase64 = safeJsonParse(decodeBase64(jsonValue));
  return maybeBase64;
}

function safeJsonParse(input?: string): ServiceAccountJSON | undefined {
  if (!input) {
    return undefined;
  }
  try {
    return JSON.parse(input) as ServiceAccountJSON;
  } catch {
    return undefined;
  }
}

function decodeBase64(value: string): string | undefined {
  try {
    const buffer = Buffer.from(value, "base64");
    const decoded = buffer.toString("utf8");
    if (!decoded || decoded === value) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}
