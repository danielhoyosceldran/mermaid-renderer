// Promise-based modal dialogs, styled like the settings panel.
//
// window.prompt/confirm are avoided because they are suppressed in some
// contexts and because a name prompt needs inline validation.

let openCount = 0;

/** True while any of these dialogs is on screen, so global shortcuts can stand down. */
export function isDialogOpen() {
  return openCount > 0;
}

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-header"><h2></h2></div>
      <div class="modal-body">
        <p class="modal-message"></p>
        <input class="modal-input" type="text" spellcheck="false" />
        <p class="modal-error" hidden></p>
      </div>
      <div class="modal-footer"></div>
    </div>
  `;
  return overlay;
}

/**
 * Show a modal and resolve with the value of the button the user picked, or
 * with `cancelValue` on Escape / backdrop click.
 *
 * buttons: [{ label, value, primary?, danger? }]
 * input:   { label, value, placeholder, validate(text) -> error|null } or null
 */
function openModal({ title, message, input = null, buttons, cancelValue = null }) {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    const dialog = overlay.querySelector('.modal-dialog');
    const footer = overlay.querySelector('.modal-footer');
    const messageEl = overlay.querySelector('.modal-message');
    const inputEl = overlay.querySelector('.modal-input');
    const errorEl = overlay.querySelector('.modal-error');

    overlay.querySelector('h2').textContent = title;
    if (message) messageEl.textContent = message;
    else messageEl.hidden = true;

    const previousFocus = document.activeElement;
    let settled = false;

    function finish(value) {
      if (settled) return;
      settled = true;
      openCount--;
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(value);
    }

    function currentText() {
      return inputEl.value;
    }

    function validate() {
      if (!input || !input.validate) return true;
      const error = input.validate(currentText());
      errorEl.textContent = error || '';
      errorEl.hidden = !error;
      return !error;
    }

    function accept(value) {
      if (input && !validate()) return;
      finish(input ? { action: value, text: currentText().trim() } : value);
    }

    if (input) {
      inputEl.value = input.value || '';
      if (input.placeholder) inputEl.placeholder = input.placeholder;
      if (input.label) inputEl.setAttribute('aria-label', input.label);
      inputEl.addEventListener('input', validate);
    } else {
      inputEl.hidden = true;
    }

    for (const spec of buttons) {
      const button = document.createElement('button');
      button.textContent = spec.label;
      button.className =
        'modal-button' + (spec.primary ? ' primary' : '') + (spec.danger ? ' danger' : '');
      button.addEventListener('click', () => {
        if (spec.value === cancelValue) finish(input ? { action: cancelValue, text: '' } : cancelValue);
        else accept(spec.value);
      });
      footer.appendChild(button);
    }

    function onKeydown(e) {
      if (!overlay.isConnected) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(input ? { action: cancelValue, text: '' } : cancelValue);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const primary = buttons.find((b) => b.primary);
        if (primary) {
          e.preventDefault();
          e.stopPropagation();
          accept(primary.value);
        }
        return;
      }
      if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const focusable = [...dialog.querySelectorAll('input:not([hidden]), button')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    }

    overlay.addEventListener('mousedown', (e) => {
      if (!dialog.contains(e.target)) finish(input ? { action: cancelValue, text: '' } : cancelValue);
    });

    // Capture, so the editor's own key handling never sees these keys.
    document.addEventListener('keydown', onKeydown, true);
    openCount++;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      if (input) {
        inputEl.focus();
        inputEl.select();
      } else {
        const primary = footer.querySelector('.primary') || footer.querySelector('button');
        if (primary) primary.focus();
      }
    });
  });
}

/** Resolves with the trimmed text, or null if cancelled. */
export async function askText({ title, message, value = '', placeholder = '', confirmLabel = 'Save', validate = null }) {
  const result = await openModal({
    title,
    message,
    input: { value, placeholder, label: title, validate },
    buttons: [
      { label: 'Cancel', value: 'cancel' },
      { label: confirmLabel, value: 'confirm', primary: true },
    ],
    cancelValue: 'cancel',
  });
  return result.action === 'confirm' ? result.text : null;
}

/** Resolves true/false. */
export async function askConfirm({ title, message, confirmLabel = 'OK', danger = false }) {
  const value = await openModal({
    title,
    message,
    buttons: [
      { label: 'Cancel', value: false },
      { label: confirmLabel, value: true, primary: !danger, danger },
    ],
    cancelValue: false,
  });
  return value === true;
}

/** Resolves with the chosen option's value, or null if dismissed. */
export function askChoice({ title, message, options }) {
  return openModal({
    title,
    message,
    buttons: [{ label: 'Cancel', value: null }, ...options],
    cancelValue: null,
  });
}
