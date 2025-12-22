import { create } from "./utils.js";

export class Notice {
  constructor(message, ttl = 5000, type = `info`, onClose) {
    const notice = (this.notice = create(`div`, {
      class: `${type} notice`,
    }));
    notice.textContent = message;
    const close = create(`button`, {
      class: "close",
    });
    close.textContent = `x`;
    notice.addEventListener(`transitionend`, () => notice.remove());
    close.addEventListener(`click`, () => {
      close.disabled = true;
      notice.style.opacity = 0;
      onClose?.();
    });
    notice.appendChild(close);
    document.body.appendChild(notice);
    if (ttl !== Infinity) {
      setTimeout(() => close.click(), ttl);
    }
  }
}

export class Warning extends Notice {
  constructor(message, ttl = Infinity, onClose) {
    super(message, ttl, `warning`, onClose);
  }
}

export class ErrorNotice extends Notice {
  constructor(message, ttl = Infinity, onClose) {
    super(message, ttl, `error`, onClose);
  }
}

export function createOneTimeNotice(message, ttl = Infinity, onClose) {
  const time = localStorage?.getItem(message) ?? 0;
  const expiry = 24 * 3600 * 1000; // 1 day
  if (time > Date.now() - expiry) return;
  localStorage?.setItem(message, Date.now());
  new Notice(message, ttl, onClose);
}

// Expose as globals, too
globalThis.__notices = { Notice, Warning, ErrorNotice, createOneTimeNotice };
