/* 小鹤音形练习 Web App - portable embedded-data build */
(() => {
  'use strict';

  const STORAGE_KEY = 'xh_shape_trainer_state_v2_portable';
  const THEME_KEY = 'xh_shape_trainer_theme_v1';
  const MODE_KEY = 'xh_shape_trainer_mode_v1';
  const CHAPTER_KEY = 'xh_shape_trainer_chapter_v1';
  const MIDDLE_PARTS_KEY = 'xh_shape_trainer_middle_parts_v1';
  const AUTO_SOUND_KEY = 'xh_shape_trainer_auto_sound_v1';
  const DEFAULT_MODE = 'copy4';
  const PREFERRED_SOUND_CODES = {
    '提': 'ti',
    '大': 'da',
    '度': 'du',
    '合': 'he',
    '期': 'qi',
    '其': 'qi',
    '么': 'me',
    '无': 'wu',
    '那': 'na',
    '区': 'qu',
    '的': 'de',
    '句': 'ju',
    '系': 'xi',
    '见': 'jm',
    '说': 'uo'
  };
  const HAN_RE = /[\u3400-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2EBEF}]|[\u{30000}-\u{3134F}]/u;
  const ONE_HAN_RE = /^(?:[\u3400-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2EBEF}]|[\u{30000}-\u{3134F}])$/u;
  const CODE_RE = /^[a-z;,'./]{1,12}$/i;

  const els = {
    folderInput: qs('#folderInput'), fileInput: qs('#fileInput'), dropZone: qs('#dropZone'),
    loadEmbeddedBtn: qs('#loadEmbeddedBtn'), clearDeckBtn: qs('#clearDeckBtn'),
    modeSelect: qs('#modeSelect'), scopeSelect: qs('#scopeSelect'), filterInput: qs('#filterInput'),
    startBtn: qs('#startBtn'), shuffleBtn: qs('#shuffleBtn'), statsBox: qs('#statsBox'),
    statItems: qs('#statItems'), statDue: qs('#statDue'), statWrong: qs('#statWrong'), statAcc: qs('#statAcc'),
    liveTotal: qs('#liveTotal'), liveCorrect: qs('#liveCorrect'), liveAcc: qs('#liveAcc'), liveWrong: qs('#liveWrong'),
    importSummary: qs('#importSummary'), questionTitle: qs('#questionTitle'), questionSubtitle: qs('#questionSubtitle'),
    card: qs('#card'),
    modeBadge: qs('#modeBadge'), promptMeta: qs('#promptMeta'), promptMain: qs('#promptMain'), promptSub: qs('#promptSub'),
    answerForm: qs('#answerForm'), answerInput: qs('#answerInput'), checkBtn: qs('#checkBtn'), feedbackBox: qs('#feedbackBox'),
    showAnswerBtn: qs('#showAnswerBtn'), markKnownBtn: qs('#markKnownBtn'), markWrongBtn: qs('#markWrongBtn'),
    searchInput: qs('#searchInput'), searchBtn: qs('#searchBtn'), searchResults: qs('#searchResults'), wrongList: qs('#wrongList'),
    manualText: qs('#manualText'), manualImportBtn: qs('#manualImportBtn'), downloadMistakesBtn: qs('#downloadMistakesBtn'),
    exportBtn: qs('#exportBtn'), importProgressInput: qs('#importProgressInput'), settingsResetBtn: qs('#settingsResetBtn'), chapterSelect: qs('#chapterSelect'), themeBtn: qs('#themeBtn'), settingsBtn: qs('#settingsBtn'), settingsModal: qs('#settingsModal'), middlePartsInput: qs('#middlePartsInput'), autoSoundInput: qs('#autoSoundInput'), noticeBtn: qs('#noticeBtn'), noticeModal: qs('#noticeModal'), loadingScreen: qs('#loadingScreen'), loadingText: qs('#loadingText')
  };
  els.modeTabs = Array.from(document.querySelectorAll('.mode-tabs [data-mode]'));

  const state = {
    items: new Map(), sessions: { total: 0, correct: 0 }, importLog: [], current: null, queue: [], rootMap: new Map(), charCodes: new Map(), composing: false, copyAnswer: '', mode: DEFAULT_MODE, chapter: 'chars', showMiddleParts: false, autoSoundCode: false
  };

  init();

  function init() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    state.showMiddleParts = localStorage.getItem(MIDDLE_PARTS_KEY) === '1';
    state.autoSoundCode = localStorage.getItem(AUTO_SOUND_KEY) === '1';
    updateSettingsToggles();
    loadState();
    bindEvents();
    const savedMode = localStorage.getItem(MODE_KEY);
    state.mode = ['copy4', 'mask2'].includes(savedMode) ? savedMode : DEFAULT_MODE;
    if (els.modeSelect) els.modeSelect.value = state.mode;
    const savedChapter = localStorage.getItem(CHAPTER_KEY);
    state.chapter = ['chars', 'words'].includes(savedChapter) ? savedChapter : 'chars';
    if (els.chapterSelect) els.chapterSelect.value = state.chapter;
    if (!state.items.size || !hasWordItems()) loadEmbeddedDeck(true);
    else { updateAll(); setIntro('已恢复上次进度', `共有 ${state.items.size} 个条目，可以继续练习。`); }
    buildCharCodeMap();
    buildRootMap();
    nextQuestion();
    finishLoading();
  }

  function bindEvents() {
    if (els.folderInput) els.folderInput.addEventListener('change', e => handleFiles(e.target.files));
    if (els.fileInput) els.fileInput.addEventListener('change', e => handleFiles(e.target.files));
    if (els.dropZone) {
      els.dropZone.addEventListener('dragover', e => { e.preventDefault(); els.dropZone.classList.add('drag'); });
      els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag'));
      els.dropZone.addEventListener('drop', e => { e.preventDefault(); els.dropZone.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
    }
    if (els.loadEmbeddedBtn) els.loadEmbeddedBtn.addEventListener('click', () => loadEmbeddedDeck(false));
    if (els.clearDeckBtn) els.clearDeckBtn.addEventListener('click', resetProgress);
    if (els.startBtn) els.startBtn.addEventListener('click', nextQuestion);
    if (els.shuffleBtn) els.shuffleBtn.addEventListener('click', () => { buildQueue(true); toast('已重新洗牌。'); });
    if (els.answerForm) els.answerForm.addEventListener('submit', onSubmitAnswer);
    if (els.answerInput) {
      els.answerInput.addEventListener('beforeinput', onBeforeInput);
      els.answerInput.addEventListener('input', onAnswerInput);
      els.answerInput.addEventListener('compositionstart', () => { state.composing = true; });
      els.answerInput.addEventListener('compositionupdate', onCompositionUpdate);
      els.answerInput.addEventListener('compositionend', onCompositionEnd);
    }
    if (els.card) els.card.addEventListener('pointerdown', focusAnswerInputNow);
    if (els.showAnswerBtn) els.showAnswerBtn.addEventListener('click', showAnswer);
    if (els.markKnownBtn) els.markKnownBtn.addEventListener('click', markKnown);
    if (els.markWrongBtn) els.markWrongBtn.addEventListener('click', markWrong);
    if (els.searchBtn) els.searchBtn.addEventListener('click', renderSearch);
    if (els.searchInput) els.searchInput.addEventListener('input', debounce(renderSearch, 120));
    if (els.filterInput) els.filterInput.addEventListener('input', debounce(() => { buildQueue(true); updateStats(); }, 180));
    if (els.modeSelect) els.modeSelect.addEventListener('change', () => setPracticeMode(els.modeSelect.value));
    els.modeTabs.forEach(btn => btn.addEventListener('click', () => setPracticeMode(btn.dataset.mode)));
    if (els.scopeSelect) els.scopeSelect.addEventListener('change', () => { buildQueue(true); updateStats(); });
    if (els.manualImportBtn) els.manualImportBtn.addEventListener('click', importManual);
    if (els.downloadMistakesBtn) els.downloadMistakesBtn.addEventListener('click', downloadMistakes);
    if (els.exportBtn) els.exportBtn.addEventListener('click', exportProgress);
    if (els.importProgressInput) els.importProgressInput.addEventListener('change', importProgress);
    if (els.settingsResetBtn) els.settingsResetBtn.addEventListener('click', resetProgress);
    if (els.chapterSelect) els.chapterSelect.addEventListener('change', () => setChapter(els.chapterSelect.value));
    if (els.themeBtn) els.themeBtn.addEventListener('click', toggleTheme);
    if (els.settingsBtn) els.settingsBtn.addEventListener('click', openSettings);
    if (els.middlePartsInput) els.middlePartsInput.addEventListener('change', () => setMiddleParts(els.middlePartsInput.checked));
    if (els.autoSoundInput) els.autoSoundInput.addEventListener('change', () => setAutoSoundCode(els.autoSoundInput.checked));
    if (els.noticeBtn) els.noticeBtn.addEventListener('click', openNotice);
    if (els.promptSub) els.promptSub.addEventListener('pointerdown', revealMaskedCode);
    if (els.promptSub) els.promptSub.addEventListener('pointerleave', hideMaskedCode);
    if (els.promptSub) els.promptSub.addEventListener('contextmenu', e => {
      if (state.current && state.current.kind === 'mask2' && e.target.closest('.copy-cell.masked')) e.preventDefault();
    });
    window.addEventListener('pointerup', hideMaskedCode);
    window.addEventListener('pointercancel', hideMaskedCode);
    if (els.settingsModal) els.settingsModal.querySelectorAll('[data-close-settings]').forEach(el => el.addEventListener('click', closeSettings));
    if (els.noticeModal) els.noticeModal.querySelectorAll('[data-close-notice]').forEach(el => el.addEventListener('click', closeNotice));
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && els.settingsModal && !els.settingsModal.hidden) { closeSettings(); return; }
      if (e.key === 'Escape' && els.noticeModal && !els.noticeModal.hidden) { closeNotice(); return; }
      if (handleCopyKeydown(e)) return;
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isTyping()) {
        e.preventDefault();
        nextQuestion();
        return;
      }
      if (e.key === '?' && !isTyping()) showAnswer();
      if (e.key === 'n' && !isTyping()) nextQuestion();
    });
  }

  function loadEmbeddedDeck(auto) {
    const bundle = window.XHUP_EMBEDDED_DATA;
    if (!bundle || !Array.isArray(bundle.entries)) {
      setIntro('没有找到内置码表', '请确认 data/xhup_codes.js 和 index.html 在同一个解压目录里。');
      return;
    }
    const records = bundle.entries.map(e => ({
      char: e.c, label: e.c, fullCode: e.f, soundCode: e.f.slice(0, 2), shapeCode: e.f.slice(2, 4), kind: 'char',
      source: `${e.s}:${e.l}`, rank: e.r, common: !!e.x
    }));
    const words = (window.XHUP_WORD_DATA && Array.isArray(window.XHUP_WORD_DATA.entries) ? window.XHUP_WORD_DATA.entries : []).map(e => ({
      char: e.w, label: e.w, fullCode: e.f, soundCode: e.f.slice(0, 2), shapeCode: e.f.slice(2, 4), kind: 'word',
      source: `${e.s}:${e.l}`, rank: e.r, common: false
    }));
    const before = state.items.size;
    mergeParsed(records);
    mergeParsed(words);
    const added = state.items.size - before;
    const meta = bundle.meta || {};
    state.importLog.unshift({ name: meta.name || '内置码表', full: records.length + words.length, aux: 0, lines: records.length + words.length, used: records.length + words.length });
    state.importLog = state.importLog.slice(0, 20);
    saveState(); buildQueue(true); updateAll();
    buildCharCodeMap();
    buildRootMap();
    setIntro('内置码表已载入', `共 ${state.items.size} 个练习条目，默认从常用字开始。`);
    if (!auto) toast(added ? `已补充 ${added} 条内置记录。` : '内置码表已经载入。');
  }

  function hasWordItems() {
    for (const item of state.items.values()) {
      if (item.kind === 'word') return true;
    }
    return false;
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter(looksLikeTextFile);
    if (!files.length) return toast('没有发现可解析的文本码表文件。');
    setIntro('正在解析码表……', `准备扫描 ${files.length} 个文件。`);
    const logs = []; let totalFull = 0, totalAux = 0, totalUsed = 0;
    for (const file of files) {
      const text = await readFileText(file);
      const name = file.webkitRelativePath || file.name;
      const res = parseTextToEntries(text, name);
      logs.push(res.log); totalFull += res.log.full; totalAux += res.log.aux; totalUsed += res.log.used;
      mergeParsed(res.records);
    }
    state.importLog = logs.concat(state.importLog).slice(0, 50);
    saveState(); buildQueue(true); updateAll();
    buildCharCodeMap();
    buildRootMap();
    setIntro('导入完成', `扫描 ${files.length} 个文件，抽取完整四码 ${totalFull} 条、辅码 ${totalAux} 条。`);
    toast(`导入完成：${totalUsed} 条可用记录。`);
  }

  function looksLikeTextFile(file) {
    const name = (file.webkitRelativePath || file.name || '').toLowerCase();
    return /\.(yaml|yml|txt|dict|tsv|csv)$/i.test(name) || name.includes('dict') || name.includes('flypy') || name.includes('rime') || name.includes('xhup');
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(String(reader.result || '')); reader.readAsText(file); });
  }

  function parseTextToEntries(text, sourceName) {
    const records = []; const lines = text.split(/\r?\n/); let full = 0, aux = 0, used = 0; let inYamlHeader = false;
    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i]; if (!raw) continue;
      if (raw.trim() === '...') { inYamlHeader = false; continue; }
      if (raw.trim() === '---') { inYamlHeader = true; continue; }
      if (inYamlHeader) continue;
      const line = stripComment(raw).trim();
      if (!line || !HAN_RE.test(line) || line.startsWith('#') || line.startsWith('---')) continue;
      const parsed = parseLine(line); if (!parsed) continue;
      for (const rec of parsed) { rec.source = `${sourceName}:${i + 1}`; records.push(rec); used++; if (rec.fullCode) full++; else if (rec.shapeCode) aux++; }
    }
    return { records, log: { name: sourceName, full, aux, lines: lines.length, used } };
  }

  function stripComment(raw) { const idx = raw.indexOf('#'); return idx >= 0 ? raw.slice(0, idx) : raw; }

  function parseLine(line) {
    const out = [];
    const kv = line.match(/^\s*((?:[\u3400-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2EBEF}]|[\u{30000}-\u{3134F}]))\s*[:=]\s*([a-z;,'./]{1,8})\s*$/iu);
    if (kv) { addRecord(out, kv[1], kv[2]); return out; }
    const tabParts = line.split(/\t+/).map(s => s.trim()).filter(Boolean);
    if (tabParts.length >= 2) {
      const word = tabParts[0]; const code = normalizeCode(tabParts[1]);
      if (isOneHan(word) && isCodeLike(code)) { addRecord(out, word, code); return out; }
      if (isOneHan(tabParts[1]) && isCodeLike(tabParts[0])) { addRecord(out, tabParts[1], tabParts[0]); return out; }
    }
    const parts = line.split(/\s+/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      if (isOneHan(parts[0]) && isCodeLike(parts[1])) { addRecord(out, parts[0], parts[1]); return out; }
      if (isOneHan(parts[1]) && isCodeLike(parts[0])) { addRecord(out, parts[1], parts[0]); return out; }
    }
    const loose = Array.from(line.matchAll(/((?:[\u3400-\u9fff\uf900-\ufaff]|[\u{20000}-\u{2EBEF}]|[\u{30000}-\u{3134F}]))\s*[,，:：=\t ]\s*([a-z;,'./]{2,6})/giu));
    for (const m of loose.slice(0, 12)) addRecord(out, m[1], m[2]);
    return out.length ? out : null;
  }

  function isOneHan(s) { return ONE_HAN_RE.test(String(s || '')); }
  function addRecord(out, char, rawCode) {
    const code0 = normalizeCode(rawCode); if (!isOneHan(char) || !isCodeLike(code0)) return;
    const variants = code0.split(/[;,，、\s]+/).map(normalizeCode).filter(isCodeLike);
    for (const code of variants.length ? variants : [code0]) {
      if (/^[a-z]{4}$/i.test(code)) out.push({ char, fullCode: code.toLowerCase(), soundCode: code.slice(0, 2).toLowerCase(), shapeCode: code.slice(2, 4).toLowerCase() });
      else if (/^[a-z]{2}$/i.test(code)) out.push({ char, fullCode: '', soundCode: '', shapeCode: code.toLowerCase() });
      else if (/^[a-z]{5,6}$/i.test(code)) { const first4 = code.slice(0, 4).toLowerCase(); out.push({ char, fullCode: first4, soundCode: first4.slice(0, 2), shapeCode: first4.slice(2, 4) }); }
    }
  }

  function normalizeCode(code) { return String(code || '').trim().toLowerCase().replace(/`/g, '').replace(/；/g, ';'); }
  function isCodeLike(s) { return !!s && CODE_RE.test(s); }
  function makeKey(rec) { return `${rec.char}\t${rec.fullCode || (rec.soundCode ? rec.soundCode + rec.shapeCode : '??' + rec.shapeCode)}`; }

  function mergeParsed(records) {
    const now = Date.now();
    for (const rec of records) {
      if (!rec.shapeCode) continue;
      const key = makeKey(rec);
      const existing = state.items.get(key);
      if (!existing) {
        state.items.set(key, { key, char: rec.char, label: rec.label || rec.char, kind: rec.kind || (isOneHan(rec.char) ? 'char' : 'word'), fullCode: rec.fullCode || '', soundCode: rec.soundCode || (rec.fullCode ? rec.fullCode.slice(0,2) : ''), shapeCode: rec.shapeCode || (rec.fullCode ? rec.fullCode.slice(2,4) : ''), sources: rec.source ? [rec.source] : [], seen: 0, correct: 0, wrong: 0, streak: 0, due: now, interval: 0, createdAt: now, updatedAt: now, rank: rec.rank || 999999, common: !!rec.common });
      } else {
        if (rec.fullCode && !existing.fullCode) { existing.fullCode = rec.fullCode; existing.soundCode = rec.soundCode; existing.shapeCode = rec.shapeCode; }
        if (rec.source && !existing.sources.includes(rec.source)) existing.sources.push(rec.source);
        existing.rank = Math.min(existing.rank || 999999, rec.rank || 999999);
        existing.common = existing.common || !!rec.common;
        existing.updatedAt = now;
      }
    }
  }

  function buildQueue(force = false) {
    if (!force && state.queue.length) return;
    const scope = state.chapter === 'words' ? 'all' : (els.scopeSelect ? els.scopeSelect.value : 'core');
    const filter = els.filterInput ? els.filterInput.value.trim().toLowerCase() : '';
    const now = Date.now();
    let items = Array.from(state.items.values()).filter(item => item.shapeCode);
    items = items.filter(item => (state.chapter === 'words') ? item.kind === 'word' : item.kind !== 'word');
    if (filter) {
      items = items.filter(item => {
        const src = item.sources.join(' ').toLowerCase(); const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : '');
        return item.char.includes(filter) || full.includes(filter) || item.soundCode.includes(filter) || item.shapeCode.includes(filter) || src.includes(filter);
      });
    }
    if (scope === 'core') items = items.filter(item => item.common || item.wrong > 0);
    if (scope === 'due') items = items.filter(item => item.due <= now || item.wrong > 0 || item.seen === 0);
    if (scope === 'wrong') items = items.filter(item => item.wrong > 0);
    if (scope === 'new') items = items.filter(item => item.seen === 0);
    items.sort((a, b) => {
      const dueA = a.due <= now ? -2 : 0, dueB = b.due <= now ? -2 : 0;
      const wrongA = a.wrong ? -3 : 0, wrongB = b.wrong ? -3 : 0;
      const newA = a.seen === 0 ? -1 : 0, newB = b.seen === 0 ? -1 : 0;
      const coreA = a.common ? -0.4 : 0, coreB = b.common ? -0.4 : 0;
      const scoreA = dueA + wrongA + newA + coreA + Math.random() * 0.8;
      const scoreB = dueB + wrongB + newB + coreB + Math.random() * 0.8;
      return scoreA - scoreB;
    });
    const seenChars = new Set();
    state.queue = [];
    for (const item of items) {
      if (seenChars.has(item.char)) continue;
      seenChars.add(item.char);
      state.queue.push(preferredItemForChar(item.char, item).key);
    }
  }

  function nextQuestion() {
    if (!state.items.size) { setIntro('正在载入码表', '准备好后就能开始。'); return; }
    buildQueue();
    if (!state.queue.length) { setIntro('当前范围没有题目', '可以重置进度后重新开始。'); return; }
    const key = state.queue.shift(); const item = state.items.get(key); if (!item) return nextQuestion();
    const mode = pickMode(item); state.current = { key, kind: mode }; state.copyAnswer = ''; renderQuestion(); clearFeedback(); if (els.answerInput) els.answerInput.value = ''; focusAnswerInput(); saveState();
  }

  function setPracticeMode(mode) {
    state.mode = ['copy4', 'mask2'].includes(mode) ? mode : DEFAULT_MODE;
    if (els.modeSelect) els.modeSelect.value = state.mode;
    localStorage.setItem(MODE_KEY, state.mode);
    updateModeTabs();
    if (!state.current) {
      nextQuestion();
      return;
    }
    const item = state.items.get(state.current.key);
    if (!item) {
      nextQuestion();
      return;
    }
    state.current.kind = pickMode(item);
    state.copyAnswer = '';
    if (els.answerInput) els.answerInput.value = '';
    clearFeedback();
    renderQuestion();
    focusAnswerInput();
  }

  function setChapter(chapter) {
    state.chapter = chapter === 'words' ? 'words' : 'chars';
    if (els.chapterSelect) els.chapterSelect.value = state.chapter;
    localStorage.setItem(CHAPTER_KEY, state.chapter);
    state.queue = [];
    state.current = null;
    state.copyAnswer = '';
    if (els.answerInput) els.answerInput.value = '';
    buildQueue(true);
    nextQuestion();
  }

  function updateModeTabs() {
    els.modeTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.mode));
  }

  function pickMode(item) {
    const selected = state.mode || (els.modeSelect && els.modeSelect.value) || DEFAULT_MODE;
    if (selected === 'mixed') { const choices = ['shape2']; if (item.fullCode) choices.push('full4', 'recognize'); return choices[Math.floor(Math.random()*choices.length)]; }
    if ((selected === 'full4' || selected === 'recognize' || selected === 'copy4' || selected === 'mask2') && !item.fullCode) return 'shape2';
    return selected;
  }

  function renderQuestion() {
    const quiz = state.current; if (!quiz) return; const item = state.items.get(quiz.key); if (!item) return;
    const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : '??' + item.shapeCode);
    updateModeTabs();
    if (els.checkBtn) {
      els.checkBtn.disabled = false;
      els.checkBtn.textContent = '检查';
    }
    if (els.answerInput) els.answerInput.removeAttribute('maxlength');
    if (els.answerForm) els.answerForm.classList.toggle('copy-hidden', quiz.kind === 'copy4' || quiz.kind === 'mask2');
    if (els.modeBadge) els.modeBadge.textContent = quiz.kind === 'shape2' ? '只练后两码' : quiz.kind === 'copy4' ? '跟打模式' : quiz.kind === 'mask2' ? '掩码模式' : quiz.kind === 'full4' ? '完整四码' : '认码';
    if (els.questionTitle) els.questionTitle.textContent = quiz.kind === 'shape2' ? '想后两码' : quiz.kind === 'copy4' ? '跟打完整四码' : quiz.kind === 'mask2' ? '看拆字想后两码' : quiz.kind === 'full4' ? '打完整四码' : '看码认字';
    if (item.kind === 'word') {
      const plan = typingPlan(quiz.kind, item);
      els.promptMeta.textContent = '词组';
      els.promptMain.textContent = item.char;
      els.promptMain.className = `prompt-main word-prompt word-len-${Math.min(Array.from(item.char).length, 8)}`;
      els.promptSub.innerHTML = renderWordCode(item, quiz.kind === 'mask2');
      if (els.questionSubtitle) els.questionSubtitle.textContent = `${item.char} = ${full}`;
      if (els.answerInput) {
        els.answerInput.placeholder = `跟打 ${full}`;
        els.answerInput.maxLength = plan.expected.length;
      }
      if (els.checkBtn) {
        els.checkBtn.disabled = true;
        els.checkBtn.textContent = '自动';
      }
      updateCopyProgress('');
    } else if (quiz.kind === 'shape2') {
      const decomp = getDecomp(item);
      els.promptMain.className = 'prompt-main';
      els.promptMeta.textContent = '后两码'; els.promptMain.textContent = item.char;
      els.promptSub.innerHTML = item.soundCode ? `前两码：<code>${escapeHtml(item.soundCode)}</code>${renderShapeHint(item, decomp)}` : `请输入它的形码后两码${renderShapeHint(item, decomp)}`;
      if (els.questionSubtitle) els.questionSubtitle.textContent = item.soundCode ? `${item.char} = ${item.soundCode} + ?${decomp.structure ? `，后两码拆作 ${decomp.structure}` : ''}` : '该条目来自辅码表，只有后两码。';
      if (els.answerInput) els.answerInput.placeholder = '例如 kp';
    } else if (quiz.kind === 'copy4') {
      const plan = typingPlan(quiz.kind, item);
      els.promptMeta.textContent = '跟打';
      els.promptMain.className = 'prompt-main';
      els.promptMain.textContent = item.char;
      els.promptSub.innerHTML = renderCodeBreakdown(item, { showRootHints: true, maskedHints: false });
      if (els.questionSubtitle) els.questionSubtitle.textContent = `${item.char} = ${full}，照着完整四码打一遍。`;
      if (els.answerInput) {
        els.answerInput.placeholder = plan.autoSound ? `跟打 ${item.shapeCode}` : `跟打 ${full}`;
        els.answerInput.maxLength = plan.expected.length;
      }
      if (els.checkBtn) {
        els.checkBtn.disabled = true;
        els.checkBtn.textContent = '自动';
      }
      updateCopyProgress('');
    } else if (quiz.kind === 'mask2') {
      const decomp = getDecomp(item);
      const plan = typingPlan(quiz.kind, item);
      els.promptMeta.textContent = '掩码';
      els.promptMain.className = 'prompt-main';
      els.promptMain.textContent = item.char;
      els.promptSub.innerHTML = renderCodeBreakdown(item, { maskShape: true, maskSound: !plan.autoSound, showRootHints: true, maskedHints: true });
      if (els.questionSubtitle) els.questionSubtitle.textContent = decomp.structure ? `${item.char}：看 ${decomp.structure}，输入后两码。` : `${item.char}：输入后两码。`;
      if (els.answerInput) {
        els.answerInput.placeholder = plan.autoSound ? '输入后两码' : '输入完整四码';
        els.answerInput.maxLength = plan.expected.length;
      }
      if (els.checkBtn) {
        els.checkBtn.disabled = true;
        els.checkBtn.textContent = '自动';
      }
      updateCopyProgress('');
    } else if (quiz.kind === 'full4') {
      els.promptMain.className = 'prompt-main';
      els.promptMeta.textContent = '完整四码'; els.promptMain.textContent = item.char; els.promptSub.innerHTML = `请输入完整码；提示：后两码是你要练的部分`;
      if (els.questionSubtitle) els.questionSubtitle.textContent = `${item.char} 的完整码是什么？`;
      if (els.answerInput) els.answerInput.placeholder = '例如 xkkp';
    } else {
      els.promptMain.className = 'prompt-main';
      els.promptMeta.textContent = '认码'; els.promptMain.textContent = full; els.promptSub.innerHTML = `请输入这个编码对应的字`;
      if (els.questionSubtitle) els.questionSubtitle.textContent = `看到 ${full}，能想到哪个字？`;
      if (els.answerInput) els.answerInput.placeholder = '输入汉字';
    }
  }

  function onSubmitAnswer(e) {
    e.preventDefault(); if (!state.current) return nextQuestion(); const item = state.items.get(state.current.key); if (!item) return;
    if (state.current.kind === 'copy4' || state.current.kind === 'mask2') return;
    const answer = normalizeAnswer(els.answerInput.value); const expected = expectedAnswer(state.current.kind, item); const ok = answer === expected;
    applyResult(item, ok); state.sessions.total++; if (ok) state.sessions.correct++; saveState(); updateAll(); showFeedback(ok, item, expected);
    if (ok) setTimeout(() => { if (state.current && state.current.key === item.key) nextQuestion(); }, 450);
  }

  function onAnswerInput(e) {
    if (!state.current || (state.current.kind !== 'copy4' && state.current.kind !== 'mask2')) return;
    if (state.composing) return;
    const inserted = e && isInsertInputType(e.inputType) ? e.data : '';
    state.copyAnswer = extractLatinAnswer(els.answerInput.value, state.copyAnswer, inserted);
    els.answerInput.value = state.copyAnswer;
    checkCopyAnswer();
  }

  function onBeforeInput(e) {
    if (!state.current || (state.current.kind !== 'copy4' && state.current.kind !== 'mask2')) return;
    if (!state.composing && e.data && !/[a-z]/i.test(e.data)) {
      e.preventDefault();
      return;
    }
    if (!state.composing || !e.data) return;
    previewComposingAnswer(e.data);
  }

  function onCompositionUpdate(e) {
    if (!state.current || (state.current.kind !== 'copy4' && state.current.kind !== 'mask2')) return;
    previewComposingAnswer(e.data);
  }

  function onCompositionEnd(e) {
    state.composing = false;
    if (!state.current || (state.current.kind !== 'copy4' && state.current.kind !== 'mask2')) return;
    if (acceptCommittedCharacter(e.data || els.answerInput.value)) return;
    state.copyAnswer = extractLatinAnswer(e.data || els.answerInput.value, state.copyAnswer);
    els.answerInput.value = state.copyAnswer;
    checkCopyAnswer();
  }

  function handleCopyKeydown(e) {
    if (!state.current || (state.current.kind !== 'copy4' && state.current.kind !== 'mask2')) return false;
    if (state.composing || e.isComposing || e.key === 'Process') return false;
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (isCodeSeparatorKey(e.key)) {
      e.preventDefault();
      return true;
    }
    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      const item = state.items.get(state.current.key); if (!item) return true;
      const expected = expectedAnswer(state.current.kind, item);
      state.copyAnswer = (state.copyAnswer + e.key.toLowerCase()).slice(0, expected.length);
      els.answerInput.value = state.copyAnswer;
      checkCopyAnswer();
      return true;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      state.copyAnswer = state.copyAnswer.slice(0, -1);
      els.answerInput.value = state.copyAnswer;
      checkCopyAnswer();
      return true;
    }
    return false;
  }

  function checkCopyAnswer() {
    const item = state.items.get(state.current.key); if (!item) return;
    const answer = state.copyAnswer;
    if ((state.current.kind === 'copy4' || state.current.kind === 'mask2') && syncPolyphonicChoice(item, answer)) return checkCopyAnswer();
    const expected = expectedAnswer(state.current.kind, item);
    updateCopyProgress(answer);
    if (answer.length === expected.length && (answer === expected || isAllowedAnswer(item, answer))) {
      applyResult(item, true);
      state.sessions.total++;
      state.sessions.correct++;
      saveState();
      updateAll();
      setTimeout(() => { if (state.current && state.current.key === item.key) nextQuestion(); }, 220);
    }
  }

  function previewComposingAnswer(raw, inserted = raw) {
    const answer = extractLatinAnswer(raw, state.copyAnswer, inserted);
    if (answer === state.copyAnswer) return;
    state.copyAnswer = answer;
    updateCopyProgress(answer);
  }

  function acceptCommittedCharacter(raw) {
    const item = state.items.get(state.current.key);
    if (!item) return false;
    const text = String(raw || '').trim();
    if (!text || !Array.from(text).includes(item.char)) return false;
    state.copyAnswer = expectedAnswer(state.current.kind, item);
    els.answerInput.value = state.copyAnswer;
    updateCopyProgress(state.copyAnswer);
    applyResult(item, true);
    state.sessions.total++;
    state.sessions.correct++;
    saveState();
    updateAll();
    setTimeout(() => { if (state.current && state.current.key === item.key) nextQuestion(); }, 220);
    return true;
  }

  function expectedAnswer(kind, item) { if (kind === 'copy4' || kind === 'mask2') return typingPlan(kind, item).expected; if (kind === 'shape2') return item.shapeCode; if (kind === 'full4') return item.fullCode || (item.soundCode + item.shapeCode); return item.char; }
  function typingPlan(kind, item) {
    const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : `??${item.shapeCode}`);
    const autoSound = !!(item.kind !== 'word' && state.autoSoundCode && (kind === 'copy4' || kind === 'mask2') && item.soundCode && item.shapeCode);
    const useShapeOnly = autoSound;
    return { full, expected: useShapeOnly ? item.shapeCode : full, offset: useShapeOnly ? 2 : 0, autoSound };
  }
  function normalizeAnswer(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ''); }

  function applyResult(item, ok) {
    const now = Date.now(); item.seen++;
    if (ok) { item.correct++; item.streak++; const steps=[60_000,10*60_000,24*60*60_000,3*24*60*60_000,7*24*60*60_000,14*24*60*60_000,30*24*60*60_000]; item.interval=steps[Math.min(item.streak-1,steps.length-1)]; item.due=now+item.interval; }
    else { item.wrong++; item.streak=0; item.interval=0; item.due=now; state.queue.splice(Math.min(3,state.queue.length),0,item.key); }
    item.updatedAt=now;
  }

  function showFeedback(ok, item, expected) {
    if (!els.feedbackBox) return;
    const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : `??${item.shapeCode}`);
    const decomp = getDecomp(item);
    const shapeText = decomp.structure ? `；拆分 <code>${escapeHtml(decomp.structure)}</code>` : '';
    els.feedbackBox.hidden=false; els.feedbackBox.className=`feedback ${ok?'ok':'bad'}`;
    els.feedbackBox.innerHTML = ok ? `对。<strong>${escapeHtml(item.char)}</strong>：后两码 <code>${escapeHtml(item.shapeCode)}</code>${shapeText}，完整码 <code>${escapeHtml(full)}</code>` : `不对。<strong>${escapeHtml(item.char)}</strong> 的答案是 <code>${escapeHtml(expected)}</code>；后两码 <code>${escapeHtml(item.shapeCode)}</code>${shapeText}，完整码 <code>${escapeHtml(full)}</code>`;
  }
  function showAnswer() {
    if (!state.current) return;
    const item = state.items.get(state.current.key); if (!item) return;
    const expected = expectedAnswer(state.current.kind, item);
    const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : `??${item.shapeCode}`);
    const decomp = getDecomp(item);
    if (!els.feedbackBox) {
      toast(`${item.char}：${expected} / ${full}${decomp.structure ? ` / ${decomp.structure}` : ''}`);
      return;
    }
    els.feedbackBox.hidden=false; els.feedbackBox.className='feedback'; els.feedbackBox.innerHTML=`答案：<strong>${escapeHtml(item.char)}</strong> 后两码 <code>${escapeHtml(item.shapeCode)}</code>${decomp.structure?`；拆分 <code>${escapeHtml(decomp.structure)}</code>`:''}${item.soundCode?`；前两码 <code>${escapeHtml(item.soundCode)}</code>`:''}；完整码 <code>${escapeHtml(full)}</code>${decomp.components?`<br>完整拆分：<code>${escapeHtml(decomp.components)}</code>`:''}<br>本题应输入：<code>${escapeHtml(expected)}</code>`;
  }
  function markKnown() { if (!state.current) return; const item = state.items.get(state.current.key); if (!item) return; applyResult(item,true); saveState(); updateAll(); nextQuestion(); }
  function markWrong() { if (!state.current) return; const item = state.items.get(state.current.key); if (!item) return; applyResult(item,false); saveState(); updateAll(); showAnswer(); }
  function clearFeedback() { if (!els.feedbackBox) return; els.feedbackBox.hidden=true; els.feedbackBox.textContent=''; els.feedbackBox.className='feedback'; }
  function finishLoading() {
    if (els.loadingText) els.loadingText.textContent = '完成';
    requestAnimationFrame(() => {
      document.body.classList.remove('app-loading');
      document.body.classList.add('app-ready');
    });
  }

  function renderSearch() {
    if (!els.searchInput || !els.searchResults) return;
    const q = normalizeAnswer(els.searchInput.value);
    if (!q) { els.searchResults.className='results empty'; els.searchResults.textContent='输入字或编码后搜索。'; return; }
    const list = Array.from(state.items.values()).filter(item => { const full=item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : ''); return item.char.includes(q) || full.includes(q) || item.soundCode.includes(q) || item.shapeCode.includes(q); }).slice(0,100);
    if (!list.length) { els.searchResults.className='results empty'; els.searchResults.textContent='没有找到。'; return; }
    els.searchResults.className='results'; els.searchResults.innerHTML=list.map(renderItem).join('');
  }
  function renderWrongList() { if (!els.wrongList) return; const wrongs=Array.from(state.items.values()).filter(i=>i.wrong>0).sort((a,b)=>b.wrong-a.wrong||b.updatedAt-a.updatedAt).slice(0,30); if(!wrongs.length){els.wrongList.className='wrong-list empty';els.wrongList.textContent='还没有错题。';return;} els.wrongList.className='wrong-list';els.wrongList.innerHTML=wrongs.map(renderItem).join(''); }
  function renderItem(item) { const full=item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : `??${item.shapeCode}`); const src=item.sources[0] ? item.sources[0].replace(/^.*\//,'') : '手动/未知来源'; return `<div class="result-item" title="${escapeHtml(item.sources.join('\n'))}"><div class="result-char">${escapeHtml(item.char)}</div><div><div class="result-code">${escapeHtml(full)} <span class="result-meta">前两码 ${escapeHtml(item.soundCode||'—')} · 后两码 ${escapeHtml(item.shapeCode||'—')}</span>${item.common?'<span class="pill">常用</span>':''}</div><div class="result-meta">见 ${item.seen} · 对 ${item.correct} · 错 ${item.wrong} · ${escapeHtml(src)}</div></div><button class="ghost" type="button" onclick="window.__xhTrainerPick('${encodeURIComponent(item.key)}')">练</button></div>`; }
  window.__xhTrainerPick = function(encodedKey){ const key=decodeURIComponent(encodedKey); if(!state.items.has(key))return; state.current={key,kind:pickMode(state.items.get(key))}; renderQuestion(); clearFeedback(); focusAnswerInput(); };

  function importManual() { if (!els.manualText) return; const text=els.manualText.value; if(!text.trim()) return toast('先粘贴一点码表内容。'); const res=parseTextToEntries(text,'manual'); mergeParsed(res.records); state.importLog.unshift(res.log); saveState(); buildQueue(true); updateAll(); setIntro('手动导入完成',`导入 ${res.log.used} 条可用记录。`); toast(`手动导入 ${res.log.used} 条。`); }
  function resetProgress() { const ok=confirm('确定清空练习进度吗？内置码表会保留/重新载入。'); if(!ok)return; state.items.clear(); state.sessions={total:0,correct:0}; state.importLog=[]; state.current=null; state.queue=[]; localStorage.removeItem(STORAGE_KEY); loadEmbeddedDeck(false); updateAll(); }
  function updateAll(){ updateStats(); renderSearch(); renderWrongList(); updateImportSummary(); }
  function updateStats(){ const items=Array.from(state.items.values()); const now=Date.now(); const wrong=items.filter(i=>i.wrong>0).length; const acc=state.sessions.total?`${Math.round(state.sessions.correct/state.sessions.total*100)}%`:'—'; if (els.statItems) els.statItems.textContent=items.length; if (els.statDue) els.statDue.textContent=items.filter(i=>i.shapeCode&&i.due<=now).length; if (els.statWrong) els.statWrong.textContent=wrong; if (els.statAcc) els.statAcc.textContent=acc; if (els.liveTotal) els.liveTotal.textContent=state.sessions.total; if (els.liveCorrect) els.liveCorrect.textContent=state.sessions.correct; if (els.liveAcc) els.liveAcc.textContent=acc; if (els.liveWrong) els.liveWrong.textContent=wrong; }
  function updateImportSummary(){ if(!els.importSummary) return; if(!state.importLog.length){els.importSummary.textContent='还没有导入码表。'; return;} const latest=state.importLog[0]; const withFull=Array.from(state.items.values()).filter(i=>i.fullCode).length; const core=Array.from(state.items.values()).filter(i=>i.common).length; els.importSummary.innerHTML=`内置/导入：<code>${escapeHtml(latest.name.replace(/^.*\//,''))}</code><br>完整四码条目：${withFull}；常用范围：${core}。`; }
  function setIntro(title, subtitle){ if (els.questionTitle) els.questionTitle.textContent=title; if (els.questionSubtitle) els.questionSubtitle.textContent=subtitle; if(!state.current){ if (els.modeBadge) els.modeBadge.textContent=state.items.size?'可开始':'未载入'; if (els.promptMeta) els.promptMeta.textContent='提示'; if (els.promptMain) { els.promptMain.className='prompt-main'; els.promptMain.textContent=state.items.size?'练':'鹤'; } if (els.promptSub) els.promptSub.textContent=subtitle;} }
  function renderCodeBreakdown(item, options = {}) {
    const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : `??${item.shapeCode}`);
    const decomp = getDecomp(item);
    const shapeParts = decomp.structure.split(/\s+/).filter(Boolean);
    const middleParts = state.showMiddleParts ? getMiddleParts(decomp) : [];
    const middle = middleParts.length ? `<div class="middle-parts-hint" aria-label="中间拆分">${middleParts.map(escapeHtml).join(' ')}</div>` : '';
    const letters = full.split('').map((ch, index) => {
      const part = index >= 2 ? shapeParts[index - 2] : '';
      const masked = (options.maskSound && index < 2) || (options.maskShape && index >= 2);
      const shown = masked ? '•' : ch;
      const hint = options.showRootHints ? (index >= 2 ? renderRootHintCard(item, index - 2, !!options.maskedHints) : '<div class="root-hint-card placeholder" aria-hidden="true"></div>') : '';
      return `<div class="copy-cell${part ? ' has-part' : ''}${masked ? ' masked' : ''}"><em>${part ? escapeHtml(part) : '&nbsp;'}</em>${index === 2 ? middle : ''}<span data-code="${escapeHtml(ch)}">${escapeHtml(shown)}</span>${hint}</div>`;
    }).join('');
    return `<div class="copy-code${middle ? ' has-middle-parts' : ''}" aria-label="完整四码">${letters}</div>`;
  }

  function renderWordCode(item, masked) {
    const full = item.fullCode || '';
    const letters = full.split('').map((ch, index) => {
      const shown = masked ? '•' : ch;
      return `<div class="copy-cell word-cell${masked ? ' masked' : ''}"><em aria-hidden="true">&nbsp;</em><span data-code="${escapeHtml(ch)}">${escapeHtml(shown)}</span></div>`;
    }).join('');
    return `<div class="copy-code word-code" aria-label="词的全码">${letters}</div>`;
  }

  function getMiddleParts(decomp) {
    const parts = String(decomp.components || '').split(/\s+/).filter(Boolean);
    const edges = String(decomp.structure || '').split(/\s+/).filter(Boolean);
    if (parts.length < 3 || edges.length < 2) return [];
    const start = parts.indexOf(edges[0]);
    const end = parts.lastIndexOf(edges[1]);
    if (start < 0 || end < 0 || end <= start + 1) return [];
    return parts.slice(start + 1, end);
  }
  function getDecomp(item) {
    if (!item || item.kind === 'word') return { structure: '', components: '' };
    const rec = window.XHUP_DECOMP_DATA && window.XHUP_DECOMP_DATA.entries && window.XHUP_DECOMP_DATA.entries[item.char];
    if (!rec) return { structure: '', components: '' };
    return { structure: rec.structure || '', components: rec.components || '' };
  }
  function buildRootMap() {
    const buckets = new Map();
    for (const item of state.items.values()) {
      if (!item.shapeCode) continue;
      const parts = getDecomp(item).structure.split(/\s+/).filter(Boolean);
      if (parts.length < 2) continue;
      [0, 1].forEach(index => {
        const key = item.shapeCode[index];
        const part = parts[index];
        if (!key || !part) return;
        if (!buckets.has(key)) buckets.set(key, new Map());
        const counts = buckets.get(key);
        counts.set(part, (counts.get(part) || 0) + (item.common ? 4 : 1));
      });
    }
    state.rootMap = new Map(Array.from(buckets.entries()).map(([key, counts]) => [
      key,
      Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans')).map(([part]) => part)
    ]));
  }
  function buildCharCodeMap() {
    const grouped = new Map();
    for (const item of state.items.values()) {
      if (!item.fullCode) continue;
      if (!grouped.has(item.char)) grouped.set(item.char, []);
      grouped.get(item.char).push(item.fullCode);
    }
    state.charCodes = new Map(Array.from(grouped.entries()).map(([char, codes]) => [
      char,
      Array.from(new Set(codes)).sort()
    ]));
  }
  function preferredItemForChar(char, fallback) {
    const candidates = Array.from(state.items.values()).filter(item => item.char === char && item.fullCode);
    if (!candidates.length) return fallback;
    const preferredSound = PREFERRED_SOUND_CODES[char];
    if (preferredSound) {
      const preferred = candidates.find(item => item.soundCode === preferredSound);
      if (preferred) return preferred;
    }
    return candidates.sort((a, b) => (a.rank || 999999) - (b.rank || 999999))[0] || fallback;
  }
  function renderPronunciationHint(item) {
    const full = item.fullCode || (item.soundCode ? item.soundCode + item.shapeCode : '');
    if (!full) return '';
    return `<div class="pronunciation-hint"><span>当前读音码 <code>${escapeHtml((item.soundCode || full.slice(0, 2)) || '—')}</code></span></div>`;
  }
  function isAllowedAnswer(item, answer) {
    if (state.current.kind !== 'copy4' && state.current.kind !== 'mask2') return false;
    if (typingPlan(state.current.kind, item).autoSound) return false;
    return (state.charCodes.get(item.char) || []).includes(answer);
  }
  function syncPolyphonicChoice(item, answer) {
    if (typingPlan(state.current.kind, item).autoSound) return false;
    if (!answer || !item.fullCode || item.fullCode.startsWith(answer)) return false;
    const match = (state.charCodes.get(item.char) || []).find(code => code.startsWith(answer));
    if (!match || match === item.fullCode) return false;
    const next = Array.from(state.items.values()).find(candidate => candidate.char === item.char && candidate.fullCode === match);
    if (!next) return false;
    state.current.key = next.key;
    renderQuestion();
    state.copyAnswer = answer;
    els.answerInput.value = answer;
    updateCopyProgress(answer);
    return true;
  }
  function renderRootHintCard(item, index, masked) {
    const decomp = getDecomp(item);
    const parts = decomp.structure.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || !item.shapeCode) return '';
    const code = item.shapeCode[index];
    const part = parts[index] || '';
    const examples = (state.rootMap.get(code) || []).filter(x => x !== part).slice(0, 5);
    const title = masked ? `${escapeHtml(part)} = ?` : `${escapeHtml(part)} = ${escapeHtml(code)}`;
    const more = examples.length ? `<small>${masked ? '同键：' : `${escapeHtml(code)}：`}${examples.map(escapeHtml).join(' ')}</small>` : '';
    return `<div class="root-hint-card"><strong>${title}</strong>${more}</div>`;
  }
  function renderShapeHint(item, decomp) {
    const shape = `<code>${escapeHtml(item.shapeCode)}</code>`;
    if (!decomp.structure) return `，后两码：${shape}`;
    const components = decomp.components && decomp.components !== decomp.structure ? `<div class="component-line">完整拆分：<code>${escapeHtml(decomp.components)}</code></div>` : '';
    return `，后两码：${shape}<div class="shape-hint"><span>${escapeHtml(decomp.structure)}</span></div>${components}`;
  }
  function updateCopyProgress(answer) {
    if (!state.current || (state.current.kind !== 'copy4' && state.current.kind !== 'mask2')) return;
    const item = state.items.get(state.current.key); if (!item) return;
    const plan = typingPlan(state.current.kind, item);
    const expected = progressExpectedAnswer(item, plan, answer);
    const offset = plan.offset;
    document.querySelectorAll('.copy-code span').forEach((span, index) => {
      const typed = answer[index - offset];
      span.className = '';
      if (index < offset) {
        span.classList.add('correct', 'autofilled');
        return;
      }
      if (!typed) span.classList.toggle('current', index === answer.length + offset);
      else span.classList.add(typed === expected[index - offset] ? 'correct' : 'wrong');
    });
  }
  function progressExpectedAnswer(item, plan, answer) {
    if (plan.autoSound) return plan.expected;
    if (!answer || !item.fullCode) return plan.expected;
    if (item.fullCode.startsWith(answer)) return plan.expected;
    return (state.charCodes.get(item.char) || []).find(code => code.startsWith(answer)) || plan.expected;
  }
  function revealMaskedCode(e) {
    if (!state.current || state.current.kind !== 'mask2') return;
    const cell = e.target.closest('.copy-cell.masked');
    if (!cell) return;
    const span = cell.querySelector('span[data-code]');
    if (!span || !span.dataset.code) return;
    e.preventDefault();
    hideMaskedCode();
    span.textContent = span.dataset.code.toUpperCase();
    span.classList.add('revealed');
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function hideMaskedCode() {
    document.querySelectorAll('.copy-cell.masked span.revealed').forEach(span => {
      span.textContent = '•';
      span.classList.remove('revealed');
    });
  }
  function focusAnswerInput() { if (!els.answerInput) return; requestAnimationFrame(focusAnswerInputNow); }
  function focusAnswerInputNow() {
    if (!els.answerInput) return;
    try { els.answerInput.focus({ preventScroll: true }); }
    catch (_) { els.answerInput.focus(); }
  }
  function isCodeSeparatorKey(key) { return key === ' ' || key === 'Spacebar' || /^[;',./，。、；‘’“”]$/.test(key); }
  function isInsertInputType(inputType) { return String(inputType || '').startsWith('insert'); }
  function extractLatinAnswer(raw, fallback, inserted) {
    const expectedLength = state.current && state.current.key ? expectedAnswer(state.current.kind, state.items.get(state.current.key) || {}).length : 4;
    const letters = String(raw || '').toLowerCase().match(/[a-z]/g);
    if (!letters) return fallback;
    const answer = letters.join('').slice(0, expectedLength);
    const insertedLetters = String(inserted || '').toLowerCase().match(/[a-z]/g);
    const hasFallback = !!fallback;
    const replacesFallback = hasFallback && !answer.startsWith(fallback);
    if (insertedLetters && replacesFallback) return (fallback + insertedLetters.join('')).slice(0, expectedLength);
    const isPartialCompositionCommit = fallback && answer.length < fallback.length && fallback.endsWith(answer);
    // Some mobile IMEs report only the committed tail on compositionend.
    if (isPartialCompositionCommit) return fallback;
    return answer;
  }
  function saveState(){ const payload={items:Array.from(state.items.values()), sessions:state.sessions, importLog:state.importLog}; localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
  function loadState(){ try{ const raw=localStorage.getItem(STORAGE_KEY); if(!raw)return; const payload=JSON.parse(raw); state.items=new Map((payload.items||[]).map(item=>[item.key || `${item.char}\t${item.fullCode || item.shapeCode}`, item])); state.sessions=payload.sessions||{total:0,correct:0}; state.importLog=payload.importLog||[]; state.queue=[]; } catch(e){ console.warn('Failed to load saved state', e); } }
  function downloadMistakes(){ const wrongs=Array.from(state.items.values()).filter(i=>i.wrong>0); if(!wrongs.length)return toast('还没有错题。'); const body=['字\t完整码\t前两码\t后两码\t见\t对\t错'].concat(wrongs.map(i=>[i.char,i.fullCode||'',i.soundCode||'',i.shapeCode||'',i.seen,i.correct,i.wrong].join('\t'))).join('\n'); downloadText('xh_shape_mistakes.tsv',body); }
  function exportProgress(){ const items=Array.from(state.items.values()); if(!items.length)return toast('没有可导出的进度。'); const payload=JSON.stringify({version:2, exportedAt:new Date().toISOString(), items, sessions:state.sessions, importLog:state.importLog},null,2); downloadText('xh_shape_progress.json',payload); }
  async function importProgress(e){ const file=e.target.files&&e.target.files[0]; e.target.value=''; if(!file)return; try{ const payload=JSON.parse(await readFileText(file)); if(!Array.isArray(payload.items))throw new Error('missing items'); state.items=new Map(payload.items.filter(item=>item&&item.char&&item.shapeCode).map(item=>[item.key || `${item.char}\t${item.fullCode || item.shapeCode}`, item])); state.sessions=payload.sessions||{total:0,correct:0}; state.importLog=payload.importLog||[]; state.current=null; state.queue=[]; saveState(); buildCharCodeMap(); buildRootMap(); buildQueue(true); updateAll(); nextQuestion(); closeSettings(); toast(`已导入 ${state.items.size} 条进度。`); }catch(err){ console.warn('Failed to import progress',err); toast('导入失败：请选择导出的进度 JSON。'); } }
  function downloadText(filename,text){ const blob=new Blob([text],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
  function toggleTheme(){ const next=document.documentElement.dataset.theme==='dark'?'':'dark'; if(next)document.documentElement.dataset.theme=next; else delete document.documentElement.dataset.theme; localStorage.setItem(THEME_KEY,next); }
  function setMiddleParts(enabled){ state.showMiddleParts = !!enabled; localStorage.setItem(MIDDLE_PARTS_KEY, state.showMiddleParts ? '1' : '0'); updateSettingsToggles(); renderQuestion(); focusAnswerInput(); }
  function setAutoSoundCode(enabled){ state.autoSoundCode = !!enabled; state.copyAnswer = ''; if (els.answerInput) els.answerInput.value = ''; localStorage.setItem(AUTO_SOUND_KEY, state.autoSoundCode ? '1' : '0'); updateSettingsToggles(); renderQuestion(); focusAnswerInput(); }
  function updateSettingsToggles(){ if (els.middlePartsInput) els.middlePartsInput.checked = state.showMiddleParts; if (els.autoSoundInput) els.autoSoundInput.checked = state.autoSoundCode; }
  function openSettings(){ if (!els.settingsModal) return; updateSettingsToggles(); els.settingsModal.hidden=false; document.body.classList.add('modal-open'); }
  function closeSettings(){ if (!els.settingsModal) return; els.settingsModal.hidden=true; document.body.classList.remove('modal-open'); focusAnswerInput(); }
  function openNotice(){ if (!els.noticeModal) return; els.noticeModal.hidden=false; document.body.classList.add('modal-open'); }
  function closeNotice(){ if (!els.noticeModal) return; els.noticeModal.hidden=true; document.body.classList.remove('modal-open'); focusAnswerInput(); }
  function toast(msg){ const div=document.createElement('div'); div.className='toast'; div.textContent=msg; document.body.appendChild(div); setTimeout(()=>div.remove(),2300); }
  function qs(sel){ return document.querySelector(sel); }
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function debounce(fn,ms){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; }
  function isTyping(){ const el=document.activeElement; return el && el !== els.answerInput && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName); }
})();
