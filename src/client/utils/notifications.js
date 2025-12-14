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
  constructor(message, ttl = Infinity) {
    super(message, ttl, `warning`);
  }
}

export class ErrorNotice extends Notice {
  constructor(message, ttl = Infinity) {
    super(message, ttl, `error`);
  }
}

export class OneTimeNotice extends Notice {
  static createIfNotRead(message, localStorageKey, ttl = Infinity) {
    if (localStorage?.getItem(localStorageKey)) {
      return;
    }

    new OneTimeNotice(message, localStorageKey, ttl);
  }

  constructor(message, localStorageKey, ttl = Infinity) {
    super(message, ttl, `info`, () => {
      localStorage?.setItem(localStorageKey, true);
    });
  }
}

// Expose as globals, too
globalThis.__notices = { Notice, Warning, ErrorNotice, OneTimeNotice };
