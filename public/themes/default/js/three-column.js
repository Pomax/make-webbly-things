const { min, max } = Math;
const container = document.querySelector(`.three-column`);
const cssVars = container.style;

function setup() {
  const dividers = [...document.querySelectorAll(`.resize`)];
  const [d1, d2] = dividers;
  const container = d1.parentNode;
  const innerWidth = () => container.getBoundingClientRect().width;

  container.addEventListener(`update:col1`, (evt) => {
    const { diff } = evt.detail;
    const curVal = getComputedStyle(container).getPropertyValue(`--d-offset-0`);
    const updated = parseFloat(curVal) + diff
    cssVars.setProperty(`--d-offset-0`, `${updated}px`);
    document.dispatchEvent(new CustomEvent(`layout:resize`));
  });

  dividers.forEach((div, i, _, down) => {
    const { left, width } = div.getBoundingClientRect();
    const ratio = (left + width / 2) / innerWidth();

    function start() {
      dividers.forEach((d) => d.classList.remove(`top`));
      div.classList.add((down = `highlight`), `top`);
    }

    [`touchstart`, `mousedown`].forEach((type) => {
      div.addEventListener(type, start);
    });

    function stop() {
      down = div.classList.remove(`highlight`);
    }

    [`touchend`, `mouseup`].forEach((type) =>
      document.addEventListener(type, stop)
    );

    function move(evt) {
      if (!down) return;
      evt.preventDefault();
      const w = innerWidth();
      const m = div === d1 ? 0 : d1.getBoundingClientRect().left + 1;
      const M = (div === d2 ? w : d2.getBoundingClientRect().left) - 1;
      const x = min(max(m, (evt.targetTouches?.[0] ?? evt).pageX), M);
      cssVars.setProperty(`--d-offset-${i}`, `${x - ratio * w}px`);
      document.dispatchEvent(new CustomEvent(`layout:resize`));
    }

    [`touchmove`, `mousemove`].forEach((type) =>
      document.addEventListener(type, move)
    );

    document.addEventListener(`contextmenu`, () => (down = false));
  });
}

window.addEventListener("load", setup);
