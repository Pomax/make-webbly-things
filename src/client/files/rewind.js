import { create, updateViewMaintainScroll } from "../utils/utils.js";
import { applyPatch } from "../../../public/vendor/diff.js";
import { syncContent } from "./sync.js";

const FORCE_SYNC = true;

/**
 * A class for handling rewinds per fileEntry
 */
export class Rewinder {
  static rewinders = [];

  static enable() {
    this.active = true;
  }

  static close() {
    const { rewinders } = this;
    for (const r of rewinders) {
      r.close();
    }
    this.active = false;
  }

  open = false;
  pos = 0;
  points = [];

  constructor(basePath, fileEntry) {
    Rewinder.rewinders.push(this);
    Object.assign(this, {
      basePath,
      fileEntry,
      content: fileEntry.state.content,
    });
  }

  hide() {
    this.open = false;
    this.ui.classList.toggle(`hidden`, true);
    this.fileEntry.state.setEditable(true);
  }

  show() {
    const { fileEntry, points, ui } = this;
    Rewinder.rewinders.forEach((r) => r.hide());
    fileEntry.state.setEditable(false);
    ui.classList.toggle(`hidden`, false);
    points[this.pos]?.click();
    this.open = true;
  }

  close() {
    const { basePath, fileEntry } = this;
    this.pos = 0;
    this.hide();
    fileEntry.classList.remove(`revision`);
    delete fileEntry.dataset.revision;
    syncContent(basePath, fileEntry, FORCE_SYNC);
  }

  setHistory(history = []) {
    this.history = history;
    this.setupUI();
  }

  /**
   * Set up, or rebuild, our rewind UI
   */
  setupUI() {
    // reset, or create, our ui element:
    const { history, points } = this;
    const ui = (this.ui ??= create(`div`, { class: `history` }));
    ui.innerHTML = ``;
    ui.classList.add(`hidden`);

    // center the track
    const midpoint = globalThis.innerWidth / 3;
    ui.style.setProperty(`--x`, `${midpoint}px`);

    // Create our rewind "train line":
    points.splice(0, points.length);
    history.forEach(({ timestamp }, i) => this.createPoint(timestamp, i));

    if (!ui.parentNode) {
      this.setupKeyListeners(ui, points);
      document.body.append(ui);
    }
  }

  /**
   * Create a "station" on our rewind "train track":
   */
  createPoint(timestamp, i) {
    const { points, ui } = this;
    const click = (evt) => {
      const point = evt.target;
      if (this.pos === i) {
        point.classList.add(`selected`);
        point.center();
        return;
      }

      // We need to apply all diffs one at a time,
      // so we have some while loopps coming up:
      points[this.pos]?.classList.remove(`selected`);
      if (this.pos < i) while (this.pos < i) this.back();
      if (this.pos > i) while (this.pos > i) this.forward();
      points[this.pos]?.classList.add(`selected`);
      point.center();
    };
    const point = create(
      `span`,
      {
        class: `point`,
        dataTime: new Date(timestamp).toLocaleString(),
      },
      { click },
    );
    point.dataset.index = i;
    point.center = () => {
      // do we need to slide the train tracks?
      const { left } = point.getBoundingClientRect();
      const midpoint = globalThis.innerWidth / 3;
      const diff = midpoint - left;
      if (diff !== 0) {
        let value = parseFloat(
          getComputedStyle(this.ui).getPropertyValue(`--x`),
        );
        value += diff;
        this.ui.style.setProperty(`--x`, `${value}px`);
      }
    };
    points.push(point);
    ui.append(point);
  }

  /**
   * Add left/right navigation and commit
   * via esc/enter keys.
   */
  setupKeyListeners(ui, points) {
    const { fileEntry } = this;
    const { tab } = fileEntry.state;

    const handleKeyInput = ({ key }) => {
      const { pos } = this;
      if (!tab.classList.contains(`active`)) {
        return; // obviously =)
      }
      if (key === `ArrowLeft`) {
        points[pos - 1]?.click();
      }
      if (key === `ArrowRight`) {
        points[pos + 1]?.click();
      }
      if (key === `Enter`) {
        this.close();
      }
      if (key === `Escape`) {
        this.close();
      }
    };

    document.addEventListener(`keydown`, handleKeyInput);
  }

  back() {
    // going back in time means increasing the history position
    const { fileEntry, history, pos } = this;

    if (pos === history.length - 1) return;

    const { reverse } = history[pos];
    let { content } = this;
    if (!content) content = `\n`;

    // console.log(reverse);

    const newContent = applyPatch(content, reverse);
    updateViewMaintainScroll(fileEntry.state, newContent, false);
    this.content = newContent;
    this.pos = this.pos + 1;

    fileEntry.classList.add(`revision`);
    fileEntry.dataset.revision = -this.pos;
  }

  forward() {
    // going forward in time means decreasing the history position
    const { fileEntry, history } = this;

    let { pos, content } = this;
    if (pos === 0) return;

    this.pos = pos = pos - 1;

    if (this.pos === 0) {
      fileEntry.classList.remove(`revision`);
      delete fileEntry.dataset.revision;
    } else {
      fileEntry.classList.add(`revision`);
      fileEntry.dataset.revision = -this.pos;
    }

    const { forward } = history[pos];
    if (!content) content = `\n`;

    // console.log(forward);

    const newContent = applyPatch(content, forward);
    updateViewMaintainScroll(fileEntry.state, newContent, false);
    this.content = newContent;
  }

  go(steps = 0) {
    if (steps === 0) return;
    // going back in time means increasing the history position
    if (steps > 0) while (steps-- !== 0) this.back();
    // going forward in time means decreasing the history position
    if (steps < 0) while (steps++ !== 0) this.forward();
  }
}
