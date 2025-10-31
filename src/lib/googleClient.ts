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
  try {
    return JSON.parse(jsonString) as ServiceAccountJSON;
  } catch (error) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS_JSON 값을 JSON으로 파싱하지 못했습니다. 문자열이 올바른 JSON인지 확인해주세요. ${(error as Error).message}`
    );
  }
}

function extractProjectIdFromJson(jsonString?: string): string | undefined {
  if (!jsonString) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonString) as ServiceAccountJSON;
    return parsed.project_id;
  } catch {
    return undefined;
  }
}
