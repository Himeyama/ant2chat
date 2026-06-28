export const geminiTestPage = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>llmglot — Gemini API テスト</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { pixel: ['"DotGothic16"', 'sans-serif'] },
          colors: {
            px: {
              bg:    '#1a1a28',
              panel: '#22223a',
              code:  '#252540',
              bdr:   '#44446a',
              txt:   '#c8cce0',
              mut:   '#7880a0',
              tea:   '#6ab8a0',
              blu:   '#6898c8',
              pur:   '#a880c0',
              red:   '#c87070',
              grn:   '#70a870',
              sel:   '#2e2e4a',
            }
          }
        }
      }
    }
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; border-radius: 0 !important; }
    :root { font-family: 'DotGothic16', sans-serif; }
    ::-webkit-scrollbar { width: 6px; height: 6px; background: #1a1a28; }
    ::-webkit-scrollbar-thumb { background: #44446a; }
    ::-webkit-scrollbar-thumb:hover { background: #7880a0; }
    code { font-family: 'DotGothic16', monospace; font-size: 0.85em; background: #252540; color: #6ab8a0; padding: 0.1em 0.4em; border: 1px solid #44446a; }
    .btn-px { box-shadow: 3px 3px 0 #44446a; transition: box-shadow 0.05s, transform 0.05s; }
    .btn-px:hover:not(:disabled) { box-shadow: 1px 1px 0 #44446a; transform: translate(1px, 1px); }
    .btn-px:active:not(:disabled) { box-shadow: none; transform: translate(3px, 3px); }
    .btn-px:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  </style>
</head>
<body class="min-h-screen bg-px-bg text-px-txt font-pixel text-sm leading-relaxed px-6 py-12">
  <main class="max-w-3xl mx-auto">

    <header class="mb-10 pb-6 border-b-2 border-px-bdr">
      <h1 class="text-2xl font-bold tracking-widest mb-3">
        <a href="/" class="text-px-txt no-underline hover:text-px-tea transition-colors"><span class="text-px-tea">▸</span> llmglot</a><span class="text-px-mut font-normal"> /v1beta/models/{model}:generateContent</span>
      </h1>
      <p class="text-px-mut text-sm">Google Gemini API (<code>generateContent</code> / <code>streamGenerateContent</code>) のテストコンソール。</p>
    </header>

    <section class="mb-10">
      <h2 class="text-xs font-bold uppercase tracking-widest text-px-mut mb-5 pb-2 border-b border-px-bdr">
        <span class="text-px-tea">■</span> リクエスト
      </h2>

      <div class="mb-4">
        <label for="f-model" class="block text-xs font-bold uppercase tracking-widest text-px-mut mb-2">model <span class="font-normal normal-case tracking-normal text-px-mut/70">（URL パスのモデル名。サーバーが --model 指定時は上書きされる）</span></label>
        <input type="text" id="f-model" value="gemini-2.5-flash" placeholder="例: gemini-2.5-flash" spellcheck="false" autocomplete="off"
          class="w-full bg-px-panel border-2 border-px-bdr text-px-txt text-sm px-3 py-2 font-pixel outline-none focus:border-px-pur">
      </div>

      <div class="mb-4">
        <label for="f-system" class="block text-xs font-bold uppercase tracking-widest text-px-mut mb-2">systemInstruction <span class="font-normal normal-case tracking-normal text-px-mut/70">（任意）</span></label>
        <textarea id="f-system" rows="3" placeholder="システムプロンプトを入力..."
          class="w-full bg-px-panel border-2 border-px-bdr text-px-txt text-sm px-3 py-2 font-pixel outline-none focus:border-px-pur resize-y"></textarea>
      </div>

      <div class="mb-4">
        <label for="f-message" class="block text-xs font-bold uppercase tracking-widest text-px-mut mb-2">message</label>
        <textarea id="f-message" rows="6" placeholder="ユーザーメッセージを入力..."
          class="w-full bg-px-panel border-2 border-px-bdr text-px-txt text-sm px-3 py-2 font-pixel outline-none focus:border-px-pur resize-y"></textarea>
      </div>

      <div class="flex flex-wrap gap-4 items-end mb-6">
        <div class="flex-1 min-w-28">
          <label for="f-max-tokens" class="block text-xs font-bold uppercase tracking-widest text-px-mut mb-2">maxOutputTokens</label>
          <input type="number" id="f-max-tokens" value="1024" min="1" max="65536"
            class="w-full bg-px-panel border-2 border-px-bdr text-px-txt text-sm px-3 py-2 font-pixel outline-none focus:border-px-pur">
        </div>
        <div class="flex-1 min-w-28">
          <label for="f-temperature" class="block text-xs font-bold uppercase tracking-widest text-px-mut mb-2">temperature <span class="font-normal normal-case tracking-normal text-px-mut/70">（任意）</span></label>
          <input type="number" id="f-temperature" step="0.1" min="0" max="2" placeholder="省略時はデフォルト"
            class="w-full bg-px-panel border-2 border-px-bdr text-px-txt text-sm px-3 py-2 font-pixel outline-none focus:border-px-pur">
        </div>
        <div class="flex-none pb-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="f-stream" class="w-4 h-4 accent-px-pur cursor-pointer">
            <span class="text-xs font-bold uppercase tracking-widest text-px-mut">stream</span>
          </label>
        </div>
      </div>

      <button id="send-btn" type="button" class="btn-px bg-px-panel border-2 border-px-bdr text-px-txt text-xs font-bold uppercase tracking-widest px-6 py-2.5 cursor-pointer">
        送信
      </button>
      <p class="text-xs text-px-mut mt-3">Ctrl+Enter / ⌘+Enter でも送信できます。ストリーミングは <code>:streamGenerateContent?alt=sse</code> を使います。</p>
    </section>

    <section id="output-section" hidden class="mb-10">
      <h2 class="text-xs font-bold uppercase tracking-widest text-px-mut mb-5 pb-2 border-b border-px-bdr">
        <span class="text-px-tea">■</span> レスポンス
      </h2>
      <div id="output-text" class="bg-px-code border-2 border-px-bdr px-4 py-3 min-h-12 text-sm leading-loose whitespace-pre-wrap break-words"></div>
      <details id="raw-details" hidden class="mt-4">
        <summary class="text-xs font-bold uppercase tracking-widest text-px-mut cursor-pointer select-none hover:text-px-txt">▹ Raw JSON</summary>
        <pre id="output-raw" class="mt-2 bg-px-code border-2 border-px-bdr px-4 py-3 overflow-x-auto text-xs leading-loose max-h-96 overflow-y-auto font-pixel text-px-txt"></pre>
      </details>
    </section>

  </main>

  <script>
    const btn           = document.getElementById('send-btn');
    const outputSection = document.getElementById('output-section');
    const outputText    = document.getElementById('output-text');
    const outputRaw     = document.getElementById('output-raw');
    const rawDetails    = document.getElementById('raw-details');

    function partsText(parts) {
      if (!parts) return '';
      return parts.filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
    }

    async function send() {
      const model     = document.getElementById('f-model').value.trim() || 'gemini-2.5-flash';
      const system    = document.getElementById('f-system').value.trim();
      const message   = document.getElementById('f-message').value.trim();
      const maxTokens = parseInt(document.getElementById('f-max-tokens').value) || 1024;
      const tempVal   = document.getElementById('f-temperature').value.trim();
      const useStream = document.getElementById('f-stream').checked;

      outputSection.hidden = false;
      outputText.className = 'bg-px-code border-2 border-px-bdr px-4 py-3 min-h-12 text-sm leading-loose whitespace-pre-wrap break-words';
      outputText.textContent = '';
      rawDetails.hidden = true;
      outputRaw.textContent = '';

      if (!message) {
        outputText.textContent = 'メッセージを入力してください。';
        outputText.className = 'bg-px-code border-2 border-px-red px-4 py-3 min-h-12 text-sm leading-loose whitespace-pre-wrap break-words text-px-red';
        return;
      }

      btn.disabled = true;
      btn.textContent = '送信中…';

      const reqBody = {
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      };
      if (system)  reqBody.systemInstruction = { parts: [{ text: system }] };
      if (tempVal) reqBody.generationConfig.temperature = parseFloat(tempVal);

      const action = useStream ? 'streamGenerateContent' : 'generateContent';
      const url = '/v1beta/models/' + model + ':' + action + (useStream ? '?alt=sse' : '');

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });

        if (useStream) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let fullText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\\n');
            buf = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              let data;
              try { data = JSON.parse(payload); } catch { continue; }

              if (data.error) {
                outputText.textContent = data.error.message || JSON.stringify(data, null, 2);
                outputText.className = 'bg-px-code border-2 border-px-red px-4 py-3 min-h-12 text-sm leading-loose whitespace-pre-wrap break-words text-px-red';
              } else {
                const cand = data.candidates && data.candidates[0];
                const t = cand && cand.content ? partsText(cand.content.parts) : '';
                if (t) {
                  fullText += t;
                  outputText.textContent = fullText;
                }
              }
            }
          }
        } else {
          const data = await res.json();
          if (!res.ok) {
            outputText.textContent = data.error && data.error.message ? data.error.message : JSON.stringify(data, null, 2);
            outputText.className = 'bg-px-code border-2 border-px-red px-4 py-3 min-h-12 text-sm leading-loose whitespace-pre-wrap break-words text-px-red';
          } else {
            const cand = data.candidates && data.candidates[0];
            const text = cand && cand.content ? partsText(cand.content.parts) : '';
            outputText.textContent = text || '(レスポンスなし)';
            rawDetails.hidden = false;
            outputRaw.textContent = JSON.stringify(data, null, 2);
          }
        }
      } catch (err) {
        outputText.textContent = err.message || String(err);
        outputText.className = 'bg-px-code border-2 border-px-red px-4 py-3 min-h-12 text-sm leading-loose whitespace-pre-wrap break-words text-px-red';
      } finally {
        btn.disabled = false;
        btn.textContent = '送信';
      }
    }

    btn.addEventListener('click', send);

    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send();
    });
  </script>
</body>
</html>`;
