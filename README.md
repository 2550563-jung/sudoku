# Sudoku Web

GitHub Pages에서 별도 서버 없이 실행되는 모바일 친화적인 스도쿠 웹게임입니다.

## 주요 기능

- 7단계 난이도: 매우 쉬움 / 쉬움 / 보통 / 어려움 / 전문가 / 마스터 / 극한
- 자동 저장 및 미완료 게임 이어하기
- 새 게임 시작 전 진행 중 게임 삭제 확인
- 실수 3회 시 즉시 실패
- 메모, 지우기, 되돌리기, 일시정지, 타이머
- 극한을 제외한 게임마다 무작위 1~4개 힌트
- 힌트 1% 실패 확률 및 사용 횟수 소모
- 점수, XP, 레벨, 현재/최고 연승
- 누적 플레이 통계
- 15종 색상 테마 및 브라우저 저장
- 모바일/Galaxy 대응 반응형 UI
- PWA manifest 및 Service Worker 오프라인 캐시

## 파일

- `index.html`
- `style.css`
- `app.js`
- `manifest.json`
- `sw.js`

## GitHub Pages

저장소 `Settings → Pages`에서 `Deploy from a branch`를 선택하고 `main` 브랜치의 `/(root)`를 배포 대상으로 설정합니다.

배포 주소:

`https://2550563-jung.github.io/sudoku/`

## 저장 데이터

게임 진행, 통계, XP, 레벨 계산용 누적 XP, 연승 및 테마는 브라우저 `localStorage`에 저장됩니다.

큰 업데이트 시 `sw.js`의 `CACHE` 값을 변경해 이전 Service Worker 캐시가 오래 남는 문제를 줄입니다. 현재 캐시 버전은 `sudoku-v5`입니다.
