export const usagePage = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>llmglot</title>
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
              yw:    '#c0a860',
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
    .btn-px { box-shadow: 3px 3px 0 #44446a; transition: box-shadow 0.05s, transform 0.05s; }
    .btn-px:hover { box-shadow: 1px 1px 0 #44446a; transform: translate(1px, 1px); }
    .btn-px:active { box-shadow: none; transform: translate(3px, 3px); }
    a { color: #6ab8a0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: 'DotGothic16', monospace; font-size: 0.85em; background: #252540; color: #6ab8a0; padding: 0.1em 0.4em; border: 1px solid #44446a; }
    pre { font-family: 'DotGothic16', monospace; font-size: 0.85rem; background: #252540; border: 2px solid #44446a; padding: 1rem; overflow-x: auto; line-height: 1.8; color: #c8cce0; }
    pre code { background: none; border: none; padding: 0; color: inherit; }
    .comment { color: #7880a0; }
  </style>
</head>
<body class="min-h-screen bg-px-bg text-px-txt font-pixel text-sm leading-relaxed px-6 py-12">
  <main class="max-w-4xl mx-auto">

    <header class="mb-10 pb-6 border-b-2 border-px-bdr">
      <h1 class="text-3xl font-bold tracking-widest mb-3 text-px-txt">
        <span class="text-px-tea">▸</span> llmglot
      </h1>
      <p class="text-px-mut text-sm leading-loose">
        Anthropic Messages API (<code>/v1/messages</code>)、OpenAI Responses API (<code>/v1/responses</code>)、OpenAI Chat Completions API (<code>/v1/chat/completions</code>)、Google Gemini API (<code>/v1beta/models/{model}:generateContent</code>) を受け取り、<br>
        上流のプロバイダー (Chat Completions / Responses API / Google Gemini など) へ変換して転送するプロキシサーバー。
      </p>
    </header>

    <section class="mb-10">
      <h2 class="text-xs font-bold uppercase tracking-widest text-px-mut mb-4 pb-2 border-b border-px-bdr">
        <span class="text-px-tea">■</span> エンドポイント
      </h2>
      <div class="border-2 border-px-bdr overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-px-panel">
              <th class="text-xs font-bold uppercase tracking-wider text-px-mut px-3 py-2 border-b border-px-bdr text-left whitespace-nowrap w-20">Method</th>
              <th class="text-xs font-bold uppercase tracking-wider text-px-mut px-3 py-2 border-b border-px-bdr text-left whitespace-nowrap w-52">Path</th>
              <th class="text-xs font-bold uppercase tracking-wider text-px-mut px-3 py-2 border-b border-px-bdr text-left">説明</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-tea/10 text-px-tea border border-px-tea/40">GET</span></td>
              <td class="px-3 py-2"><code>/</code></td>
              <td class="px-3 py-2 text-px-mut">このページを表示</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-tea/10 text-px-tea border border-px-tea/40">GET</span></td>
              <td class="px-3 py-2"><a href="/v1/messages"><code>/v1/messages</code></a></td>
              <td class="px-3 py-2 text-px-mut">Messages API テストページ (ブラウザ) / <code>{"status":"ok"}</code> (API)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-blu/10 text-px-blu border border-px-blu/40">POST</span></td>
              <td class="px-3 py-2"><code>/v1/messages</code></td>
              <td class="px-3 py-2 text-px-mut">Anthropic Messages API 互換エンドポイント</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-tea/10 text-px-tea border border-px-tea/40">GET</span></td>
              <td class="px-3 py-2"><a href="/v1/responses"><code>/v1/responses</code></a></td>
              <td class="px-3 py-2 text-px-mut">Responses API テストページ (ブラウザ) / <code>{"status":"ok"}</code> (API)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-blu/10 text-px-blu border border-px-blu/40">POST</span></td>
              <td class="px-3 py-2"><code>/v1/responses</code></td>
              <td class="px-3 py-2 text-px-mut">OpenAI Responses API 互換エンドポイント (HTTP)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-pur/10 text-px-pur border border-px-pur/40">WS</span></td>
              <td class="px-3 py-2"><code>/v1/responses</code></td>
              <td class="px-3 py-2 text-px-mut">OpenAI Responses API 互換エンドポイント (WebSocket)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-tea/10 text-px-tea border border-px-tea/40">GET</span></td>
              <td class="px-3 py-2"><a href="/v1/chat/completions"><code>/v1/chat/completions</code></a></td>
              <td class="px-3 py-2 text-px-mut">Chat Completions API テストページ (ブラウザ) / <code>{"status":"ok"}</code> (API)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-blu/10 text-px-blu border border-px-blu/40">POST</span></td>
              <td class="px-3 py-2"><code>/v1/chat/completions</code></td>
              <td class="px-3 py-2 text-px-mut">OpenAI Chat Completions API 互換エンドポイント (パススルー / Gemini 変換)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-tea/10 text-px-tea border border-px-tea/40">GET</span></td>
              <td class="px-3 py-2"><a href="/v1beta/models/gemini-2.5-flash:generateContent"><code>/v1beta/models/{model}:…</code></a></td>
              <td class="px-3 py-2 text-px-mut">Gemini API テストページ (ブラウザ) / <code>{"status":"ok"}</code> (API)</td>
            </tr>
            <tr class="hover:bg-px-sel">
              <td class="px-3 py-2"><span class="text-xs font-bold px-2 py-0.5 bg-px-blu/10 text-px-blu border border-px-blu/40">POST</span></td>
              <td class="px-3 py-2"><code>/v1beta/models/{model}:generateContent</code></td>
              <td class="px-3 py-2 text-px-mut">Google Gemini API 互換エンドポイント (<code>:streamGenerateContent</code> でストリーミング)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="text-xs font-bold uppercase tracking-widest text-px-mut mb-4 pb-2 border-b border-px-bdr">
        <span class="text-px-tea">■</span> CLI オプション
      </h2>
      <div class="border-2 border-px-bdr overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-px-panel">
              <th class="text-xs font-bold uppercase tracking-wider text-px-mut px-3 py-2 border-b border-px-bdr text-left whitespace-nowrap w-64">オプション</th>
              <th class="text-xs font-bold uppercase tracking-wider text-px-mut px-3 py-2 border-b border-px-bdr text-left whitespace-nowrap w-28">デフォルト</th>
              <th class="text-xs font-bold uppercase tracking-wider text-px-mut px-3 py-2 border-b border-px-bdr text-left">説明</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>--provider &lt;name&gt;</code></td>
              <td class="px-3 py-2"><code>ollama</code></td>
              <td class="px-3 py-2 text-px-mut">上流プロバイダー: <code>ollama</code> | <code>openai</code> | <code>responses</code> | <code>openrouter</code> | <code>google</code> | <code>gemini</code> | <code>azure</code></td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>-u, --url &lt;url&gt;</code></td>
              <td class="px-3 py-2 text-px-mut">—</td>
              <td class="px-3 py-2 text-px-mut">上流ベース URL。<code>--provider</code> 省略時は URL からプロバイダーを自動判定</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>-p, --port &lt;port&gt;</code></td>
              <td class="px-3 py-2"><code>3000</code></td>
              <td class="px-3 py-2 text-px-mut">Listen ポート</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>-k, --api-key &lt;key&gt;</code></td>
              <td class="px-3 py-2 text-px-mut">—</td>
              <td class="px-3 py-2 text-px-mut">上流 API キー</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>--auth-type &lt;type&gt;</code></td>
              <td class="px-3 py-2"><code>bearer</code></td>
              <td class="px-3 py-2 text-px-mut">認証ヘッダー形式: <code>bearer</code> | <code>api-key</code></td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>-m, --model &lt;model&gt;</code></td>
              <td class="px-3 py-2 text-px-mut">—</td>
              <td class="px-3 py-2 text-px-mut">モデル名を強制指定 (クライアントの <code>model</code> フィールドを上書き)</td>
            </tr>
            <tr class="border-b border-px-bdr/40 hover:bg-px-sel">
              <td class="px-3 py-2"><code>-g, --global</code></td>
              <td class="px-3 py-2 text-px-mut">—</td>
              <td class="px-3 py-2 text-px-mut"><code>0.0.0.0</code> でリッスン (ネットワークに公開)</td>
            </tr>
            <tr class="hover:bg-px-sel">
              <td class="px-3 py-2"><code>--no-search</code></td>
              <td class="px-3 py-2 text-px-mut">—</td>
              <td class="px-3 py-2 text-px-mut">組み込み Web 検索ツールを無効化</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="text-xs font-bold uppercase tracking-widest text-px-mut mb-4 pb-2 border-b border-px-bdr">
        <span class="text-px-tea">■</span> 使用例
      </h2>
      <pre><span class="comment"># Ollama (デフォルト)</span>
llmglot -u http://localhost:11434/v1 -m llama3.2

<span class="comment"># OpenAI</span>
llmglot --provider openai --api-key sk-xxx --model gpt-4o

<span class="comment"># OpenAI Responses API</span>
llmglot --provider responses --api-key sk-xxx --model gpt-5

<span class="comment"># OpenRouter</span>
llmglot --provider openrouter --api-key sk-or-xxx --model anthropic/claude-3.5-sonnet

<span class="comment"># Google Gemini</span>
llmglot --provider gemini --api-key AIzaSy-xxx --model gemini-2.0-flash

<span class="comment"># Azure (プロバイダー明示)</span>
llmglot --provider azure --api-key &lt;key&gt; -u https://&lt;resource&gt;.openai.azure.com/openai/deployments/&lt;deployment&gt; -m gpt-4o

<span class="comment"># Azure は URL 指定のみでも自動判定</span>
llmglot -u https://&lt;resource&gt;.openai.azure.com/openai/deployments/&lt;deployment&gt; -k &lt;key&gt; -m gpt-4o

<span class="comment"># Gemini は models/{model}:generateContent 形式の URL を直接指定可能</span>
llmglot -u https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent -k AIzaSy-xxx

<span class="comment"># 受信側で Gemini 形式を使う例 (上流はどのプロバイダーでも可)</span>
curl http://localhost:3000/v1beta/models/gemini-2.5-flash:generateContent \\
  -H 'Content-Type: application/json' \\
  -d '{"contents":[{"role":"user","parts":[{"text":"hello"}]}]}'</pre>
    </section>

  </main>
</body>
</html>`;
