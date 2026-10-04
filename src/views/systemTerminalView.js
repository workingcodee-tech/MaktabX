/**
 * MaktabX Vazifalar Paneli (MaktabX Tasks Panel)
 * - To'liq qora fon (#000000), sof yashil shrift (#00ff66)
 * - Chiqish tugmasi MAVJUD EMAS
 * - 100% Ingliz tilida ishlaydi
 * - Hech qachon foydalanuvchiga to'liq/ortiqcha ma'lumot bermaydi:
 *   faqat buyruq to'g'ri bo'lsa yoki amalga oshsa muvaffaqiyat xabari beradi, boshqa ma'lumot bermaydi.
 * - Noto'g'ri ma'lumot/buyruq kiritilsa javob qaytarmaydi (jim turadi).
 */

export function renderSystemTerminal(container, {
  state,
  onCommitChanges,
  onCloseTerminal
}) {
  // Console stages: 'LOCKED_WAITING_CODE' -> 'LOCKED_WAITING_TIME' -> 'ACTIVATED'
  let currentStage = 'LOCKED_WAITING_CODE';

  // Staged changes - committed only when /done is executed
  const stagedChanges = {
    newDevLogin: null,
    newDevPassword: null,
    restoredLogins: []
  };

  const logs = [
    "MaktabX Tasks Panel [Version 2.4.0]",
    "(c) MaktabX System. All rights reserved.",
    "",
    "maktabx> _"
  ];

  // Time validation: HHMM format (+/- 2 minutes leeway)
  function isValidCurrentTime(inputStr) {
    if (!inputStr) return false;
    const clean = inputStr.replace(/[:\s]/g, '').trim();
    if (!/^\d{4}$/.test(clean)) return false;

    const now = new Date();
    for (let offset = -2; offset <= 2; offset++) {
      const checkDate = new Date(now.getTime() + offset * 60 * 1000);
      const h = String(checkDate.getHours()).padStart(2, '0');
      const m = String(checkDate.getMinutes()).padStart(2, '0');
      if (`${h}${m}` === clean) {
        return true;
      }
    }
    return false;
  }

  function extractQuotedValue(cmdStr) {
    const match = cmdStr.match(/['"‘“`](.+?)['"’”]/);
    return match ? match[1].trim() : null;
  }

  container.innerHTML = `
    <div id="system-terminal-root" class="fixed inset-0 z-[999999] bg-[#000000] text-[#00ff66] font-mono select-text flex flex-col overflow-hidden">
      
      <!-- MaktabX Tasks Panel Header (No close button) -->
      <div class="h-9 bg-[#000000] border-b border-[#00ff66]/30 px-3 flex items-center justify-between select-none shrink-0">
        <!-- Title -->
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2 px-2.5 py-1 bg-[#000000] border border-[#00ff66]/40 text-[#00ff66] text-xs font-semibold rounded-sm">
            <span class="inline-block w-2 h-2 rounded-full bg-[#00ff66] animate-pulse"></span>
            <span>MaktabX Tasks Panel</span>
          </div>
        </div>

        <!-- Secure session status (NO EXIT BUTTON) -->
        <div class="flex items-center gap-2 text-[11px] text-[#00ff66]/70 pr-1">
          <span>TASK-SESSION-ACTIVE</span>
        </div>
      </div>

      <!-- Main Console Body -->
      <div id="terminal-body" class="flex-1 p-3 sm:p-5 overflow-y-auto font-mono text-[13px] sm:text-[14px] leading-relaxed space-y-1 bg-[#000000] scrollbar-thin scrollbar-thumb-[#00ff66]/20">
        <div id="terminal-log-output" class="space-y-1"></div>

        <!-- Active prompt row -->
        <div class="flex items-center gap-2 pt-1">
          <span id="terminal-prompt" class="text-[#00ff66] font-bold select-none shrink-0">maktabx&gt;</span>
          <div class="relative flex-1 flex items-center">
            <input 
              type="text" 
              id="terminal-cli-input" 
              autofocus 
              autocomplete="off" 
              spellcheck="false"
              class="w-full bg-transparent text-[#00ff66] font-mono text-[13px] sm:text-[14px] focus:outline-none border-none ring-0 p-0 m-0 caret-[#00ff66]"
            />
          </div>
        </div>
      </div>

      <!-- Bottom Status Bar -->
      <div class="h-6 bg-[#000000] border-t border-[#00ff66]/30 px-3 flex items-center justify-between text-[11px] text-[#00ff66]/60 select-none shrink-0 font-mono">
        <span>ENCODING: UTF-8 | SYSTEM: MAKTABX CORE</span>
        <span id="terminal-status-indicator">STATUS: STANDBY</span>
      </div>

    </div>
  `;

  const logOutput = container.querySelector('#terminal-log-output');
  const cliInput = container.querySelector('#terminal-cli-input');
  const terminalBody = container.querySelector('#terminal-body');
  const statusIndicator = container.querySelector('#terminal-status-indicator');

  function renderLogs() {
    if (!logOutput) return;
    logOutput.innerHTML = logs.map(line => {
      if (!line) return `<div class="h-2"></div>`;
      return `<div class="whitespace-pre-wrap break-all">${escapeHtml(line)}</div>`;
    }).join('');

    if (terminalBody) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderLogs();

  // Focus input whenever user clicks anywhere inside the panel
  container.querySelector('#system-terminal-root')?.addEventListener('click', () => {
    cliInput?.focus();
  });

  cliInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawVal = cliInput.value;
      const val = rawVal.trim();
      cliInput.value = '';

      handleTerminalInput(val);
    }
  });

  async function handleTerminalInput(input) {
    const promptPrefix = "maktabx>";

    // =========================================================================
    // STAGE 1: WAITING FOR SECRET CODE ("1q(2w)3e_4r!")
    // =========================================================================
    if (currentStage === 'LOCKED_WAITING_CODE') {
      if (input === '1q(2w)3e_4r!') {
        currentStage = 'LOCKED_WAITING_TIME';
        // Silent transition (no leak) or clean prompt
        logs.push(`${promptPrefix}`);
        renderLogs();
      } else {
        // WRONG INPUT: COMPLETELY SILENT (no response)
        logs.push(`${promptPrefix}`);
        renderLogs();
      }
      return;
    }

    // =========================================================================
    // STAGE 2: WAITING FOR CURRENT TIME (HHMM)
    // =========================================================================
    if (currentStage === 'LOCKED_WAITING_TIME') {
      if (isValidCurrentTime(input)) {
        currentStage = 'ACTIVATED';
        if (statusIndicator) {
          statusIndicator.textContent = "STATUS: 100% READY";
        }
        logs.push(`${promptPrefix}`);
        logs.push("");
        logs.push("[SYSTEM]: Core tasks initialized.");
        logs.push("[SYSTEM]: Ready.");
        logs.push("");
        renderLogs();
      } else {
        // WRONG TIME: COMPLETELY SILENT (no response)
        logs.push(`${promptPrefix}`);
        renderLogs();
      }
      return;
    }

    // =========================================================================
    // STAGE 3: ACTIVATED (100% English, only concise success message, silent on invalid)
    // =========================================================================
    if (currentStage === 'ACTIVATED') {
      // 1. /newdevlogin 'yangi login'
      if (/^\/newdevlogin\s+['"‘“`](.+?)['"’”]$/i.test(input)) {
        const newLogin = extractQuotedValue(input);
        if (newLogin) {
          stagedChanges.newDevLogin = newLogin;
          logs.push(`${promptPrefix} ${input}`);
          logs.push(`[SUCCESS]: Parameter updated.`);
          renderLogs();
          return;
        }
      }

      // 2. /newdevpas 'yangi parol'
      if (/^\/newdevpas\s+['"‘“`](.+?)['"’”]$/i.test(input)) {
        const newPass = extractQuotedValue(input);
        if (newPass) {
          stagedChanges.newDevPassword = newPass;
          logs.push(`${promptPrefix} ${input}`);
          logs.push(`[SUCCESS]: Parameter updated.`);
          renderLogs();
          return;
        }
      }

      // 3. /refresh 'foydalanuvchi login'
      if (/^\/refresh\s+['"‘“`](.+?)['"’”]$/i.test(input)) {
        const targetLogin = extractQuotedValue(input);
        if (targetLogin) {
          const trashList = state.trash || [];
          const nowMs = Date.now();
          const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

          const foundItem = trashList.find(item => {
            if (!item || !item.login) return false;
            const isMatch = String(item.login).toLowerCase().trim() === String(targetLogin).toLowerCase().trim();
            if (!isMatch) return false;
            const itemTime = item.deletedAt ? new Date(item.deletedAt).getTime() : 0;
            return (nowMs - itemTime) <= oneWeekMs;
          });

          if (foundItem) {
            stagedChanges.restoredLogins.push(foundItem);
            logs.push(`${promptPrefix} ${input}`);
            logs.push(`[SUCCESS]: Record recovered.`);
            renderLogs();
            return;
          }
          // Not found or expired -> INVALID -> STAY SILENT!
          logs.push(`${promptPrefix}`);
          renderLogs();
          return;
        }
      }

      // 4. /done (commit and sync changes)
      if (/^\/done$/i.test(input)) {
        logs.push(`${promptPrefix} /done`);
        if (onCommitChanges) {
          try {
            await onCommitChanges(stagedChanges);
            logs.push("[SUCCESS]: Changes committed and synchronized.");
          } catch (err) {
            // Do not leak internal trace, only concise status
            logs.push("[FAILED]: Synchronization error.");
          }
        } else {
          logs.push("[SUCCESS]: Changes committed.");
        }
        renderLogs();
        return;
      }

      // 5. /exit (close terminal once 100% active)
      if (/^\/exit$/i.test(input)) {
        logs.push(`${promptPrefix} /exit`);
        logs.push("[SUCCESS]: Session terminated.");
        renderLogs();
        setTimeout(() => {
          if (onCloseTerminal) {
            onCloseTerminal();
          }
        }, 500);
        return;
      }

      // INVALID / UNRECOGNIZED COMMAND -> STAY COMPLETELY SILENT
      logs.push(`${promptPrefix}`);
      renderLogs();
    }
  }
}
