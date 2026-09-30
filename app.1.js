  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const filenameEl = document.getElementById('filename');
  const outputEl = document.getElementById('output');
  const errorEl = document.getElementById('error');
  const textInput = document.getElementById('textInput');
  const openBtn = document.getElementById('openBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const viewToggle = document.getElementById('viewToggle');
  const savedName = document.getElementById('savedName');
  const editor = document.getElementById('editor');

  let currentName = 'untitled.md';
  let fileHandle = null;   // only the file picker hands one back; drag-drop cannot
  let saveTimer = null;

  // Live preview as you type, then autosave once typing stops.
  textInput.addEventListener('input', changed);

  // Tab inserts spaces instead of moving focus out of the editor.
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = textInput.selectionStart, en = textInput.selectionEnd;
      textInput.value = textInput.value.slice(0, s) + '  ' + textInput.value.slice(en);
      textInput.selectionStart = textInput.selectionEnd = s + 2;
      changed();
    }
  });

  // Open a file for editing. The picker is the only route to a writable handle.
  openBtn.addEventListener('click', async () => {
    if (!window.showOpenFilePicker) return fileInput.click();
    try {
      const [h] = await window.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }] });
      const file = await h.getFile();
      fileHandle = h;
      currentName = file.name;
      filenameEl.textContent = file.name;
      savedName.textContent = file.name + ' \u00b7 autosaving';
      textInput.value = await file.text();
      renderMarkdown();
    } catch (err) {
      // closing the picker is not an error
      if (err.name !== 'AbortError') showError('Could not open: ' + err.message);
    }
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  // Drag & drop a file onto the dropzone.
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  // Cycle Split -> Edit -> Preview view modes.
  const modes = ['split', 'edit', 'preview'];
  const labels = { split: 'Split', edit: 'Edit', preview: 'Preview' };
  viewToggle.addEventListener('click', () => {
    const next = modes[(modes.indexOf(viewToggle.dataset.mode) + 1) % modes.length];
    viewToggle.dataset.mode = next;
    viewToggle.textContent = 'View: ' + labels[next];
    editor.classList.toggle('edit-only', next === 'edit');
    editor.classList.toggle('preview-only', next === 'preview');
  });

  // Download the current editor content as a .md file.
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([textInput.value], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  function handleFile(file) {
    errorEl.style.display = 'none';
    fileHandle = null;
    currentName = file.name || 'untitled.md';
    filenameEl.textContent = file.name;
    savedName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      textInput.value = reader.result;
      renderMarkdown();
    };
    reader.onerror = () => showError('Could not read this file.');
    reader.readAsText(file);
  }

  // render now, write to disk 800ms after the last keystroke
  function changed() {
    renderMarkdown();
    if (!fileHandle) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 800);
  }

  async function save() {
    try {
      const w = await fileHandle.createWritable();
      await w.write(textInput.value);
      await w.close();
      savedName.textContent = currentName + ' \u00b7 saved ' + new Date().toLocaleTimeString();
    } catch (err) {
      showError('Could not save: ' + err.message);
    }
  }

  function renderMarkdown() {
    errorEl.style.display = 'none';
    try {
      outputEl.innerHTML = marked.parse(textInput.value || '');
    } catch (err) {
      showError('Could not render this: ' + err.message);
    }
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  // Initial render (in case there's prefilled content).
  renderMarkdown();
