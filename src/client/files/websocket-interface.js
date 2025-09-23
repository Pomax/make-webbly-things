import { create } from "../utils/utils.js";
import { WebSocketInterface } from "custom-file-tree";
import { applyPatch } from "../../../public/vendor/diff.js";
import { syncContent } from "./sync.js";

// Our websocket interface needs some functions that are not
// offered as part of the standard file tree ws interface:
export class CustomWebsocketInterface extends WebSocketInterface {
  constructor(...args) {
    super(...args);
    this.bypassSync.push(`filehistory`);
  }

  // We're adding some more functions!
  // notably: history traversal for files.

  async getFileHistory(path) {
    this.send(`filehistory`, { path });
  }

  async onfilehistory({ path, history }) {
    if (history.length === 0) return;

    const fileEntry = document.querySelector(`file-entry[path="${path}"]`);
    const div = create(`div`, { class: `history` });
    let { view, content } = fileEntry.state;
    let pos = 0;

    /**
     * Go back in time one step.
     */
    function rollBack() {
      if (pos === history.length - 1) return;
      const { reverse } = history[pos];
      if (!content) content = `\n`;
      const newContent = applyPatch(content, reverse);
      // console.log(content, reverse, newContent);

      // FIXME: this is not the only place we set the scrollpostion followed
      //        by a view update dispatch, so we probably want to unify that.
      //        Search for RPL1423 to find the other spot(s) we do this.
      const entry = fileEntry.state;
      entry.scrollPosition = view.dom.querySelector(`.cm-scroller`).scrollTop;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newContent,
        },
        // FIXME: for this to work properly,
        //        we need to disable the editor
      });
      content = newContent;
      pos += 1;
    }

    /**
     * Go forward in time one step.
     */
    function fastForward() {
      if (pos === 0) return;
      pos -= 1;
      const { forward } = history[pos];
      if (!content) content = `\n`;
      const newContent = applyPatch(content, forward);
      // console.log(content, forward, newContent);
      fileEntry.state.scrollPosition =
        view.dom.querySelector(`.cm-scroller`).scrollTop;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newContent,
        },
        // FIXME: for this to work properly,
        //        we need to disable the editor
      });
      content = newContent;
    }

    // Create our rewind "train line"!
    const points = history.map(({ timestamp }, i) => {
      const point = create(
        `span`,
        {
          class: `point`,
          dataTime: new Date(timestamp).toLocaleString(),
        },
        {
          click: () => {
            if (pos === i) return;
            // We need to apply all diffs one at a time,
            // so we have some while loopps coming up:
            points[pos]?.classList.remove(`selected`);
            if (pos < i) while (pos < i) rollBack();
            if (pos > i) while (pos > i) fastForward();
            points[pos]?.classList.add(`selected`);
          },
        },
      );
      point.dataset.index = i;
      div.append(point);
      return point;
    });

    // make sure we select the current rewind point.
    points[0].classList.add(`selected`);

    // mutation observer should not be necessary for an
    // "I got removed from the DOM" event, but here we are.
    div.addEventListener(`close`, () => {
      div.remove();
      syncContent(projectSlug, fileEntry);
    });

    // Add key handling for navigating/commiting rewinds.
    const keyNav = ({ key }) => {
      if (key === `ArrowLeft`) {
        points[pos - 1]?.click();
      }
      if (key === `ArrowRight`) {
        points[pos + 1]?.click();
      }
      if (key === `Enter`) {
        div.dispatchEvent(new CustomEvent(`close`));
      }
      if (key === `Escape`) {
        div.dispatchEvent(new CustomEvent(`close`));
      }
    };

    document.addEventListener(`keydown`, keyNav);
    document.body.append(div);
  }
}
