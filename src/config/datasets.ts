export type DatasetConfig = {
  id: 'gangnamunni' | 'babitalk' | 'goddessicket';
  label: string;
  tableLabel: string;
  schemaFile: string;
  bigQueryTableId: string;
};

export const DATASETS: DatasetConfig[] = [
  {
    id: 'gangnamunni',
    label: '강남언니 Data Raw',
    tableLabel: '강남언니 Raw',
    schemaFile: 'gangnamunni.csv',
    bigQueryTableId: 'tugether-data-warehouse-01.06_mkt.01_keyword_search_raw',
  },
  {
    id: 'babitalk',
    label: '바비톡 Data Raw',
    tableLabel: '바비톡 Raw',
    schemaFile: 'babitalk.csv',
    bigQueryTableId: 'tugether-data-warehouse-01.06_mkt.02_consult_booking_raw',
  },
  {
    id: 'goddessicket',
    label: '여신티켓 Data Raw',
    tableLabel: '여신티켓 Raw',
    schemaFile: 'goddessicket.csv',
    bigQueryTableId: 'tugether-data-warehouse-01.06_mkt.03_campaign_performance_raw',
  },
];

export const DATASET_LOOKUP = DATASETS.reduce<Record<DatasetConfig['id'], DatasetConfig>>(
  (acc, dataset) => {
    acc[dataset.id] = dataset;
    return acc;
  },
  {} as Record<DatasetConfig['id'], DatasetConfig>
);
