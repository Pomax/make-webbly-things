import { create } from "./utils.js";

export class Notice {
  constructor(message, ttl = 5000, type = `info`) {
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
