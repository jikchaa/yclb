# YOUTH CLUB SEOUL — 공개 사이트

`seoulyouthclub.com` 으로 나갈 외부 공개용 사이트다. Astro 로 짓고 GitHub Pages 로
올린다.

회원 전용 이벤트 보드는 **다른 저장소**(`jikchaa/seoulyouthclub`)에 있고 여기와
아무 관계가 없다. 한쪽이 깨져도 다른 쪽은 멀쩡하다.

```
npm install
npm run dev      # http://localhost:4321
npm run build
```

## 글은 화면에서 고친다

`/admin/` 이 관리자 화면이다. GitHub 토큰을 한 번 넣어 두면 브라우저에서 바로
고치고 [게시]를 누를 수 있다. 게시하면 이 저장소의 파일이 바뀌고, 그 변경이
Actions 를 깨워 사이트가 1~2분 안에 다시 지어진다.

```
브라우저(/admin/) ──▶ GitHub Contents API ──▶ main 의 JSON 파일
                                                  │
                        사이트 ◀── Actions 빌드 ◀──┘
```

토큰은 그 브라우저(localStorage)에만 있고 저장소에 올라가지 않는다. 토큰이 없는
사람은 화면을 열어 볼 수는 있어도 아무것도 저장하지 못한다.

| 탭 | 고치는 파일 | 무엇 |
|---|---|---|
| 사이트 글 | `src/data/content.json` | 히어로·믿는 것·기록·프로그램·셰프·가입·About |
| 이벤트 기록 | `src/data/events.json` | 제목·날짜·장소·갈래·숨김 |

손으로 파일을 고쳐 커밋해도 결과는 같다.

## 고칠 곳

| 무엇 | 어디 |
|---|---|
| 사이트의 모든 글 | `src/data/content.json` (또는 `/admin/`) |
| 이벤트 기록 | `src/data/events.json` (또는 `/admin/`) |
| 색·글꼴·간격 | `src/styles/global.css` |
| 포스터 | `public/posters/` |
| 화면 구조 | `src/pages/`, `src/components/` |

`src/data/site.ts` 에는 문구를 적지 않는다 — `content.json` 을 읽어 이름만 붙인다.

## 글에서 쓸 수 있는 표시

- `**별 두 개**` → **굵게**
- 줄바꿈 → 제목과 맺음말에서는 그 자리에서 줄이 바뀐다
- 기록 설명의 `{since}` · `{month}` → 첫 모임의 연도와 달로 자동으로 바뀐다

그 밖의 HTML 태그는 글자 그대로 나온다. 일부러 그렇게 두었다.

## 이벤트 데이터

노션 위키의 Upcoming/Past Events 에서 가져왔다. 포스터는 위키 갤러리 순서가 본문
목록 순서와 같다는 점을 이용해 붙였고, 네 건을 눈으로 대조해 확인했다.

- `date` 가 비어 있고 `draft` 인 건은 **위키 내보내기에서 날짜가 잘린 것**이다.
  날짜를 지어 넣지 않았고 사이트에도 내지 않는다. 관리자 화면 [이벤트 기록] 탭에서
  날짜를 넣고 '숨김'을 풀면 그때 나온다.
- 2020-10-10 으로 몰려 있던 다섯 줄은 실제 모임이 아니라 프로그램 견본이라
  아카이브에서 뺐다. 포스터는 `public/posters/programs/` 에 있다.

## 검색 노출과 주소

빌드 때 환경 변수 세 개로 결정한다. `.github/workflows/deploy.yml` 에 있다.

| | 지금 (도메인 전) | 도메인 붙인 뒤 |
|---|---|---|
| `SITE_URL` | `https://jikchaa.github.io` | `https://seoulyouthclub.com` |
| `SITE_BASE` | `/yclb/` | (지움) |
| `SITE_INDEX` | `0` | `1` |

`SITE_INDEX` 가 `1` 이 아니면 모든 페이지에 `noindex` 가 붙고 `robots.txt` 가 전부
막는다. 미리보기 주소가 색인되면 도메인을 붙인 뒤 중복 페이지로 남기 때문이다.
`1` 일 때도 `/admin/` 은 막는다.

내부 링크는 전부 `src/lib/url.ts` 의 `url()` 을 지나므로 `SITE_BASE` 를 지우는 것
말고 따로 고칠 링크는 없다.

## 첫 배포

저장소 Settings → Pages → Source 를 **GitHub Actions** 로 바꿔야 워크플로가
실제로 배포한다. 그 전에는 빌드만 돌고 아무 데도 올라가지 않는다.
