# AI 채팅 중계 서버 (Cloudflare Workers)

캐릭터 채팅에서 기본 검색이 못 알아듣는 질문만 이 서버를 거쳐 Google Gemini가 답한다.
API 키는 Cloudflare 안에만 있고, 사이트·저장소에는 들어가지 않는다.

1. Google AI Studio(aistudio.google.com) → Get API key → 키 만들기 (결제 연결 없이 무료 등급)
2. Cloudflare 대시보드 → Workers & Pages → Create → Worker → 이름 `nikkei-chat` → Deploy
3. Edit code → `chat-worker.js` 내용 전체 붙여넣기 → Deploy
4. Settings → Variables and Secrets → Add → Secret `GEMINI_API_KEY` = 1번 키
5. (선택) Storage → KV → `chat-count` 만들기 → 워커 Settings → Bindings → KV namespace, 변수 이름 `CHAT_KV` (하루 상한 `DAILY_LIMIT`, 기본 200)
6. 워커 주소(https://nikkei-chat.<계정>.workers.dev)를 `dashboard/data/chat_config.json` 의 `api` 에 넣는다.

안전장치: 허용된 사이트(ALLOWED_ORIGINS)에서만 응답, IP당 10분 20회, KV 연결 시 하루 상한, 질문 300자·자료 15,000자 제한.
결제 수단을 연결하지 않은 Gemini 무료 등급이면 한도를 넘어도 요금이 나가지 않고, 사이트는 기본 검색 답으로 돌아간다.
