# 택배 숨바꼭질

물류센터 컨베이어 위, 수십 개의 택배 상자 사이에 진짜 사람이 섞여 있다. 숨는 쪽은 상자인 척하며 목표를 채우고, 찾는 쪽(직원)은 "무궁화 꽃이 피었습니다"처럼 신호를 걸어 움직이다 걸린 상자를 바코드 스캐너로 찍는다.

지금은 웹 브라우저에서 도는 프로토타입이고, AI 상대로 숨는 쪽·찾는 쪽 둘 다 해볼 수 있다. 친구와 하는 멀티는 아직 없다.

## 지금 상태

- 버전: v12 (v11에서 핵심만 남기고 덜어낸 판, 폰 가로 화면 지원)
- 플레이: `dist/index.html`을 브라우저로 열면 바로 된다. 인터넷 연결은 필요하다(three.js를 CDN에서 받음). 폰은 가로로 들고 한다.
- 공개 링크(작업자 계정 비공개 아티팩트): https://claude.ai/artifact/K2fKfUXg8q79ACiVMjHk2c
- 시험 갈래 `v12-stop`(벨트 정지 반응 시험, 브랜치): https://claude.ai/artifact/2veiV9GwGgzi8DjVwQRtTS

## 고치고 확인하는 법

```
npm run check
```

엔진과 화면을 합쳐 `dist/index.html`을 다시 만들고, 엔진 테스트와 화면 흐름 테스트(지금 판, 스위치 다 켠 판)를 돌린다. 설치할 패키지는 없다(node만 있으면 됨).

## 문서 지도

처음 온 사람(또는 AI)은 이 순서로 읽는다.

1. `HANDOFF.md` 지금 어디까지 왔고 다음에 뭘 하나
2. `AGENTS.md` 작업 규칙
3. `docs/1-concept/` 게임 기획과 컨셉 (무엇을, 왜)
   - `pitch.md` 한 줄 소개, 왜 이 장르, 어떻게 여기까지 왔나
   - `rules.md` 지금 확정된 규칙
   - `decisions.md` 시도했다가 버린 것과 이유
   - `references.md` 참고한 게임들
   - `roadmap.md` 다음 단계와 검토 중인 아이디어
4. `docs/2-design/` 게임 구체화 설계 (실제로 어떻게 돌아가나)
   - `architecture.md` 파일 구조와 흐름
   - `engine.md` 상자 이동, 신호, 걸림 판정, 도장, 시간 보정
   - `ai.md` AI 직원과 숨은 AI
   - `map-format.md` 맵 공유 문자열과 편집기
   - `balance.md` 조절 손잡이와 지금 값

## 폴더

```
src/engine.js     규칙만 (화면 없음, node로 테스트 가능)
src/game.html     3D 화면, 조작, 메뉴, 편집기, 기록 (/*ENGINE*/ 자리에 엔진이 들어감)
src/build.mjs     둘을 합쳐 dist/index.html 생성
dist/index.html   완성본
tests/            엔진 테스트, 화면 흐름 테스트
archive/          지난 버전 완성본 (비교용, 고치지 않음)
```
