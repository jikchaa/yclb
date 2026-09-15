/* 검색 노출 스위치.
   github.io 미리보기 주소가 색인되면 도메인을 붙인 뒤 중복 페이지로 남는다.
   그래서 기본은 '색인 막기'이고, 실제 도메인으로 배포할 때만 켠다. */
export const indexable = process.env.SITE_INDEX === '1';
