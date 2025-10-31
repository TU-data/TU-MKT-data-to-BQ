import { promises as fs } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { DATASETS, DatasetConfig } from "@/config/datasets";

export type SchemaField = {
  sourceName: string;
  dataType: string;
  targetName: string;
};

const SCHEMA_HEADERS = {
  source: "기존 컬럼명",
  type: "데이터 타입",
  target: "영어 컬럼명",
};

const SCHEMA_DIRECTORY = join(process.cwd(), "src", "config", "schemas");

export async function loadSchemaByFile(schemaFile: string): Promise<SchemaField[]> {
  const schemaPath = join(SCHEMA_DIRECTORY, schemaFile);
  const csvBuffer = await fs.readFile(schemaPath);
  const rows = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return rows.map((row) => {
    const sourceName = row[SCHEMA_HEADERS.source];
    const dataType = row[SCHEMA_HEADERS.type];
    const targetName = row[SCHEMA_HEADERS.target];

    if (!sourceName || !dataType || !targetName) {
      throw new Error(
        `스키마 CSV(${schemaFile})에 누락된 컬럼 값이 있습니다. 각 행에 '${SCHEMA_HEADERS.source}', '${SCHEMA_HEADERS.type}', '${SCHEMA_HEADERS.target}' 값이 모두 필요합니다.`
      );
    }

    return {
      sourceName,
      dataType,
      targetName,
    };
  });
}

export type DatasetWithSchema = DatasetConfig & {
  schema: SchemaField[];
};

export async function getDatasetsWithSchema(): Promise<DatasetWithSchema[]> {
  return Promise.all(
    DATASETS.map(async (dataset) => {
      const schema = await loadSchemaByFile(dataset.schemaFile);
      return {
        ...dataset,
        schema,
      };
    })
  );
}

export async function getDatasetWithSchema(
  datasetId: DatasetConfig["id"]
): Promise<DatasetWithSchema | undefined> {
  const dataset = DATASETS.find((item) => item.id === datasetId);
  if (!dataset) {
    return undefined;
  }

  const schema = await loadSchemaByFile(dataset.schemaFile);
  return {
    ...dataset,
    schema,
  };
}
