## 개요

이 프로젝트는 마케팅 Raw 데이터를 CSV로 업로드해 BigQuery 테이블에 적재하는 내부용 웹 콘솔입니다.  
로그인은 비밀번호 한 줄로 처리하며, 데이터셋별 스키마와 BigQuery 테이블은 컨피그/CSV 파일로 관리합니다.

## 배포 전 준비 사항 (Vercel 기준)

- 환경 변수
  - `APP_LOGIN_PASSWORD`: 접속 시 사용할 비밀번호
  - `BIGQUERY_PROJECT_ID`: (옵션) `dataset.table` 형태의 테이블 ID를 쓰는 경우 기본 프로젝트 ID
  - Google 인증 정보: 서비스 계정 키 JSON을 사용한다면
    - `GOOGLE_APPLICATION_CREDENTIALS_JSON`: JSON 문자열을 그대로 저장 후 런타임에서 임시 파일로 저장
    - 또는 키 파일을 Vercel Secret으로 업로드한 뒤 해당 경로를 사용
- 서비스 계정 권한
  - 대상 BigQuery 테이블에 `BigQuery Data Editor` 이상 권한이 필요합니다.
- 컨피그 확인
  - `src/config/datasets.ts`: 데이터셋 ID/라벨/스키마 CSV 경로/BigQuery 테이블 ID(`project.dataset.table` 형식)를 실제 값으로 수정
  - `src/config/schemas/*.csv`: “기존 컬럼명, 데이터 타입, 영어 컬럼명” 3개 컬럼을 가진 스키마 매핑 파일. 실제 헤더와 타입에 맞게 업데이트

## 로컬 테스트 (선택 사항)

```bash
npm install

export APP_LOGIN_PASSWORD="비밀번호"
export BIGQUERY_PROJECT_ID="프로젝트ID" # 컨피그에 project가 없을 때 필수
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → 비밀번호 입력 → 데이터셋 선택 후 CSV 업로드 → 로그 확인.

## 사용 흐름

1. 페이지 접속 후 비밀번호를 입력해 로그인합니다. (세션 쿠키는 8시간 유지)
2. 상단 버튼에서 업로드 대상 데이터셋(강남언니/바비톡/여신티켓 등)을 선택합니다.
3. 선택된 데이터셋의 스키마 CSV가 자동으로 로드되고, 화면 우측에서 매핑 정보(기존 컬럼명 ↔ 영어 컬럼명)와 BigQuery Table ID를 확인할 수 있습니다.
4. “CSV 파일을 업로드 해주세요” 영역을 클릭하여 원본 CSV를 선택합니다.
   - 업로드 시 헤더가 스키마 CSV의 “기존 컬럼명”과 정확히 일치해야 합니다.
5. 서버는 스키마에 정의된 영어 컬럼명으로 헤더와 데이터를 변환한 뒤 지정된 BigQuery 테이블(`WRITE_APPEND`)에 업로드합니다.
6. 업로드 진행 상황과 결과가 하단 로그에 순서대로 출력되며, 작업 완료 후 임시 파일은 삭제됩니다.
7. 로그아웃은 우측 상단 버튼으로 수행합니다.

## BigQuery 테이블 ID 작성 규칙

- `project.dataset.table` 혹은 `dataset.table` 형식을 지원합니다.
- 컨피그에 프로젝트 ID가 포함되어 있으면 그대로 사용하고, 없으면 `BIGQUERY_PROJECT_ID` 환경 변수를 사용합니다.

## 스키마/데이터셋 확장 방법

1. `src/config/schemas/새파일.csv`를 작성 (헤더 3개: 기존 컬럼명, 데이터 타입, 영어 컬럼명)
2. `src/config/datasets.ts`에 새 데이터셋 객체를 추가
3. 배포하면 새 데이터셋 버튼이 자동으로 노출됩니다.

## 배포

- Vercel에 이 레포를 연결한 뒤 위의 환경 변수를 설정하고 배포하면 됩니다.
- BigQuery 인증이 필요한 경우, Vercel `Project Settings → Environment Variables`에 서비스 계정 키를 등록하거나 Secret을 사용하세요.

이 문서를 참고하면 추가 설명 없이도 바로 서버에 올리고 운영할 수 있습니다. 즐거운 운영 되세요! 🎉
