// src/ui/webview.html.ts
import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview): string {
  const csp = webview.cspSource;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${csp} 'unsafe-inline'; style-src ${csp} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Private Copilot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-sideBar-background);
      --bg-tertiary: var(--vscode-input-background);
      --fg-primary: var(--vscode-editor-foreground);
      --fg-secondary: var(--vscode-descriptionForeground);
      --border-color: var(--vscode-panel-border);
      --button-bg: var(--vscode-button-background);
      --button-hover: var(--vscode-button-hoverBackground);
      --button-fg: var(--vscode-button-foreground);
      --code-bg: var(--vscode-textCodeBlock-background);
      --user-msg-bg: var(--vscode-button-secondaryBackground);
      --ai-msg-bg: var(--vscode-textBlockQuote-background);
      --highlight: var(--vscode-focusBorder);
    }

    body {
      font-family: var(--vscode-font-family);
      background: var(--bg-primary);
      color: var(--fg-primary);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    #chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      scroll-behavior: smooth;
    }

    .message {
      margin-bottom: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      max-width: 90%;
      word-wrap: break-word;
      line-height: 1.6;
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      background: var(--user-msg-bg);
      margin-left: auto;
      border-bottom-right-radius: 4px;
    }

    .message.ai {
      background: var(--ai-msg-bg);
      margin-right: auto;
      border-bottom-left-radius: 4px;
    }

    .message.system {
      background: var(--bg-tertiary);
      border-left: 3px solid var(--highlight);
      font-size: 0.9em;
      opacity: 0.8;
    }

    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--ai-msg-bg);
      border-radius: 8px;
      max-width: 150px;
      margin-bottom: 16px;
    }

    .typing-dots {
      display: flex;
      gap: 4px;
    }

    .typing-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--fg-secondary);
      animation: typing 1.4s infinite;
    }

    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
      30% { transform: translateY(-8px); opacity: 1; }
    }

    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      position: relative;
    }

    .code-block::before {
      content: attr(data-language);
      position: absolute;
      top: 4px;
      right: 8px;
      font-size: 0.75em;
      color: var(--fg-secondary);
      opacity: 0.6;
      text-transform: uppercase;
    }

    .code-block pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .inline-code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
    }

    strong { font-weight: 600; color: var(--highlight); }
    em { font-style: italic; }
    
    a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }

    .toolbar {
      display: flex;
      gap: 8px;
      padding: 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .toolbar button {
      padding: 6px 12px;
      font-size: 12px;
      flex: 1;
      min-width: 100px;
    }

    .input-container {
      display: flex;
      gap: 8px;
      padding: 12px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
    }

    #input {
      flex: 1;
      padding: 10px 12px;
      background: var(--bg-tertiary);
      color: var(--fg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 14px;
      font-family: var(--vscode-font-family);
      resize: none;
      max-height: 150px;
    }

    #input:focus {
      outline: 1px solid var(--highlight);
      border-color: var(--highlight);
    }

    button {
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
      white-space: nowrap;
    }

    button:hover:not(:disabled) {
      background: var(--button-hover);
      transform: translateY(-1px);
    }

    button:active:not(:disabled) {
      transform: translateY(0);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }

    .btn-danger {
      background: var(--vscode-errorForeground);
    }

    .btn-success {
      background: #28a745;
    }

    .hidden { display: none !important; }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .action-buttons button {
      padding: 6px 12px;
      font-size: 12px;
    }

    ul, ol {
      margin: 8px 0;
      padding-left: 24px;
    }

    li {
      margin: 4px 0;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }

    th, td {
      border: 1px solid var(--border-color);
      padding: 8px;
      text-align: left;
    }

    th {
      background: var(--button-bg);
      color: var(--button-fg);
      font-weight: 600;
    }

    #welcome {
      text-align: center;
      padding: 40px 20px;
      color: var(--fg-secondary);
    }

    #welcome h2 {
      color: var(--fg-primary);
      margin-bottom: 16px;
    }

    .status-bar {
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--fg-secondary);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #28a745;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="btn-explain" class="btn-secondary" title="Explain selected code">
      📖 Explain
    </button>
    <button id="btn-fix" class="btn-secondary" title="Fix errors in code">
      🔧 Fix
    </button>
    <button id="btn-ask" class="btn-secondary" title="Ask about selected code">
      💬 Ask
    </button>
    <button id="btn-test" class="btn-secondary" title="Generate tests">
      ✅ Tests
    </button>
    <button id="btn-health" class="btn-secondary" title="Check LLM health">
      🏥 Health
    </button>
    <button id="btn-clear" class="btn-danger" title="Clear chat history">
      🗑️ Clear
    </button>
  </div>

  <div id="chat-container">
    <div id="welcome">
      <h2>🤖 Private Copilot</h2>
      <p>Your AI coding assistant is ready!</p>
      <p style="margin-top: 8px; font-size: 0.9em;">Select code and use toolbar buttons, or type your question below.</p>
    </div>
  </div>

  <div class="status-bar">
    <div class="status-indicator">
      <span class="status-dot"></span>
      <span>Ready</span>
    </div>
    <span id="model-info"></span>
  </div>

  <div class="input-container">
    <textarea id="input" placeholder="Ask anything... (Shift+Enter for new line)" rows="1"></textarea>
    <button id="btn-send">Send</button>
    <button id="btn-stop" class="btn-danger hidden">Stop</button>
  </div>

  <script>${getWebviewScript()}</script>
</body>
</html>`;
}

function getWebviewScript(): string {
  return `
(function() {
  const vscode = acquireVsCodeApi();
  
  const elements = {
    chatContainer: document.getElementById('chat-container'),
    input: document.getElementById('input'),
    btnSend: document.getElementById('btn-send'),
    btnStop: document.getElementById('btn-stop'),
    btnClear: document.getElementById('btn-clear'),
    btnExplain: document.getElementById('btn-explain'),
    btnFix: document.getElementById('btn-fix'),
    btnAsk: document.getElementById('btn-ask'),
    btnTest: document.getElementById('btn-test'),
    btnHealth: document.getElementById('btn-health'),
    welcome: document.getElementById('welcome'),
    modelInfo: document.getElementById('model-info'),
  };

  let currentAiMessage = null;
  let isProcessing = false;
  let typingIndicator = null;

  // Auto-resize textarea
  elements.input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
  });

  // Send message on Enter (Shift+Enter for new line)
  elements.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  elements.btnSend.addEventListener('click', sendMessage);
  elements.btnStop.addEventListener('click', () => postMessage('stopGeneration'));
  elements.btnClear.addEventListener('click', () => postMessage('clearChat'));
  elements.btnExplain.addEventListener('click', () => postMessage('explainCode'));
  elements.btnFix.addEventListener('click', () => postMessage('fixError'));
  elements.btnAsk.addEventListener('click', () => postMessage('askSelected'));
  elements.btnTest.addEventListener('click', () => postMessage('generateTests'));
  elements.btnHealth.addEventListener('click', () => postMessage('healthCheck'));

  function sendMessage() {
    const text = elements.input.value.trim();
    if (!text || isProcessing) return;

    postMessage('sendMessage', { text });
    elements.input.value = '';
    elements.input.style.height = 'auto';
  }

  function postMessage(command, data = {}) {
    vscode.postMessage({ command, ...data });
  }

  function addMessage(role, content) {
    if (elements.welcome) {
      elements.welcome.remove();
    }

    const msg = document.createElement('div');
    msg.className = \`message \${role}\`;
    msg.innerHTML = formatContent(content);
    elements.chatContainer.appendChild(msg);
    scrollToBottom();
  }

  function formatContent(text) {
    let formatted = text;

    // Code blocks
    formatted = formatted.replace(/\`\`\`(\w+)?\\n([\\s\\S]*?)\\n\`\`\`/g, (match, lang, code) => {
      const language = lang || 'plaintext';
      const escaped = code.trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return \`<div class="code-block" data-language="\${language}"><pre><code>\${escaped}</code></pre></div>\`;
    });

    // Inline code
    formatted = formatted.replace(/\`([^\`]+)\`/g, '<span class="inline-code">$1</span>');

    // Bold
    formatted = formatted.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

    // Links
    formatted = formatted.replace(/\\[([^\\]]+)\\]\\(([^\\)]+)\\)/g, '<a href="$2">$1</a>');

    // Line breaks
    formatted = formatted.replace(/\\n/g, '<br>');

    return formatted;
  }

  function showTypingIndicator() {
    if (typingIndicator) return;

    typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = \`
      <span>AI is thinking</span>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    \`;
    elements.chatContainer.appendChild(typingIndicator);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    if (typingIndicator) {
      typingIndicator.remove();
      typingIndicator = null;
    }
  }

  function scrollToBottom() {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
  }

  function setProcessing(processing) {
    isProcessing = processing;
    elements.btnSend.classList.toggle('hidden', processing);
    elements.btnStop.classList.toggle('hidden', !processing);
    elements.input.disabled = processing;
    
    const toolbarButtons = [elements.btnExplain, elements.btnFix, elements.btnAsk, elements.btnTest, elements.btnHealth];
    toolbarButtons.forEach(btn => btn.disabled = processing);
  }

  // Handle messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.command) {
      case 'startProcessing':
        setProcessing(true);
        showTypingIndicator();
        break;

      case 'endProcessing':
        setProcessing(false);
        hideTypingIndicator();
        break;

      case 'startAiStream':
        hideTypingIndicator();
        currentAiMessage = document.createElement('div');
        currentAiMessage.className = 'message ai';
        elements.chatContainer.appendChild(currentAiMessage);
        scrollToBottom();
        break;

      case 'aiChunk':
        if (currentAiMessage) {
          const content = currentAiMessage.textContent || '';
          currentAiMessage.textContent = content + message.content;
          scrollToBottom();
        }
        break;

      case 'endAiStream':
        if (currentAiMessage) {
          currentAiMessage.innerHTML = formatContent(message.content);
          currentAiMessage = null;
        }
        break;

      case 'updateChat':
        addMessage(message.role, message.content);
        break;

      case 'clearChat':
        elements.chatContainer.innerHTML = '';
        elements.chatContainer.appendChild(elements.welcome.cloneNode(true));
        break;

      case 'setModelInfo':
        elements.modelInfo.textContent = message.info;
        break;
    }
  });

  // Handle dynamic buttons (accept/reject)
  elements.chatContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.hasAttribute('data-command')) {
      const command = e.target.getAttribute('data-command');
      e.target.disabled = true;
      postMessage(command);
    }
  });

  // Focus input on load
  elements.input.focus();
})();
`;
}