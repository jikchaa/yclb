# YOUTH CLUB SEOUL — 공개 사이트

`seoulyouthclub.com` 으로 나갈 외부 공개용 사이트. Astro 로 짓고 GitHub Pages 로 올린다.
회원 전용 이벤트 보드는 **다른 저장소**(`jikchaa/seoulyouthclub`)에 있고 여기와 관계가 없다.

## 사이트는 관리자 화면에서 만든다

`/admin/` 에서 사이트의 모든 것을 고친다. 코드를 열 필요가 없다.

| 탭 | 하는 일 |
|---|---|
| 페이지 | 페이지 추가·복제·삭제, 섹션 추가·순서·숨김·삭제, 각 섹션의 글·버튼·이미지·배경·여백 |
| 메뉴·바닥글 | 머리글 메뉴(추가·삭제·순서·버튼 모양), 바닥글 글과 링크 |
| 디자인 | 색 조합 6종 + 색 하나씩, 글꼴(본문·제목 따로), 크기·굵기·줄간격, 버튼·모서리, 로고와 로고 위치 |
| 프로그램 | 프로그램 목록 — 프로그램 섹션과 이벤트 필터 탭이 된다 |
| 이벤트 | 기록 추가·삭제, 날짜·장소·이미지, 숨김 |
| 이미지 | 올리기, 자르기, 지우기, 어디서 쓰는지 |
| 기본 설정 | 사이트 이름·설명, 가입 폼 주소, 공유 이미지, 아이콘 |

오른쪽 미리보기는 **공개 사이트를 짓는 바로 그 코드**(`src/render/`)로 그린다. 그래서
미리보기에 보이는 것이 게시 후 사이트에 나오는 것과 같다. 미리보기에서 구역을 누르면 그
구역의 편집 칸이 열린다.

[게시]를 누르면 글·이벤트·새 이미지·지운 이미지가 **커밋 하나**로 `main` 에 올라가고,
Actions 가 1~2분 안에 사이트를 다시 짓는다. 관리자 화면 위쪽에 진행 상황이 뜬다.
빌드가 실패하면 사이트는 이전 상태 그대로 남는다.

### 토큰

처음 한 번, 쓰기 권한이 있는 GitHub 토큰을 넣어야 게시할 수 있다.
Fine-grained token → Repository access: `jikchaa/yclb` 만 → Contents: Read and write.
토큰은 그 브라우저(localStorage)에만 있고 저장소에 올라가지 않는다.

### 이미지

올린 이미지는 자르기 창을 거쳐 줄여서 저장한다. 사진은 긴 변 1920px 이하 WebP, 로고는 투명
배경을 지키려고 PNG, 공유 이미지는 1200×630 JPG, 아이콘은 512×512 PNG. 게시 전까지는 그
브라우저에만 있으니 창을 닫기 전에 게시해야 한다(닫으려 하면 경고한다).

## 구조

```
src/data/site.json      사이트의 모든 글·페이지·섹션·메뉴·디자인 설정
src/data/events.json    이벤트 기록
public/                 이미지(posters/, uploads/), 글꼴, 아이콘
src/render/             데이터 → HTML. 사이트 빌드와 관리자 미리보기가 같이 쓴다
  schema.ts             섹션 종류와 각 종류의 입력 칸 (관리자 화면도 이걸 보고 그린다)
  sections.ts           섹션 종류별 HTML
  layout.ts             머리글·바닥글·<head>
  theme.ts              색 조합, 테마 → CSS 변수, 배경 밝기에 따른 글자색
  fonts.ts              고를 수 있는 글꼴
src/styles/site.css     모든 모양. 색·글꼴·크기 값은 여기 없고 CSS 변수로 들어온다
src/pages/[...slug].astro  site.json 의 페이지마다 주소를 만든다
src/admin/              관리자 화면
scripts/check-editable.mjs  보이는 글자가 모두 데이터에서 오는지 검사
```

### 새 섹션 종류를 더하려면

`schema.ts` 에 종류와 칸을 적고, `sections.ts` 에 그리는 함수를 넣고, `site.css` 에 모양을
넣는다. 관리자 화면은 `schema.ts` 를 읽어 입력 칸을 스스로 그린다.

### 글자는 코드에 적지 않는다

사이트에 보이는 글자는 전부 `site.json`/`events.json` 에서 와야 한다. 그래야 관리자에서
고칠 수 있다. `npm run check:editable` 이 이를 검사한다 — 데이터의 글자를 모두 한 칸씩
민(가→각) 사본으로 한 번 더 지어서, 그런데도 그대로 남은 글자를 찾는다. 배포 때마다
자동으로 돈다.

## 글에서 쓸 수 있는 표시

- `**굵게**`, `[글자](page:about)` 링크, 줄바꿈
- `{eventCount}` `{placeCount}` `{programCount}` `{since}` `{sinceMonth}` `{latestYear}` `{year}`
  → 게시할 때 실제 값으로 바뀐다

그 밖의 HTML 태그는 글자 그대로 나온다. 글에 꺾쇠가 섞여도 화면이 깨지지 않게 일부러 그렇게 두었다.

## 글꼴

기본은 Pretendard 1.3.9(SIL OFL, `public/fonts/pretendard/` 에 들어 있음). 한글·영문·숫자·기호를 한 글꼴로
그려서 한 줄 안에서 글꼴이 갈라지지 않는다. 한글 본문 자간은 0, 단어 중간에서 줄을 끊지
않는다(`word-break: keep-all`). 다른 글꼴을 고르면 Google Fonts 에서 불러온다.

## 검색 노출과 주소

`.github/workflows/deploy.yml` 의 환경 변수 셋으로 정한다.

| | 지금 (도메인 전) | 도메인 붙인 뒤 |
|---|---|---|
| `SITE_URL` | `https://jikchaa.github.io` | `https://seoulyouthclub.com` |
| `SITE_BASE` | `/yclb/` | (지움) |
| `SITE_INDEX` | `0` | `1` |

`SITE_INDEX` 가 `1` 이 아니면 모든 페이지에 `noindex` 가 붙고 `robots.txt` 가 전부 막는다.
페이지별로 검색에서 빼려면 관리자 [페이지 설정]의 "검색 결과에서 빼기".

```
npm install
npm run dev              # http://localhost:4321  (관리자: /admin/)
npm run build
npm run check:editable
```
