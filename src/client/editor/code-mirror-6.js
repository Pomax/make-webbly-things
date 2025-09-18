// This test script uses Codemirror v6
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";

// Language-specific features:
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
// See https://github.com/orgs/codemirror/repositories?q=lang for more options

/**
 * Create an initial CodeMirror6 state object
 */
export function getInitialState(fileEntry, filename, data) {
  const doc = data.toString();
  const extensions = [
    basicSetup,
    EditorState.readOnly.of(!document.body.dataset.projectMember),
  ];

  // Can we add syntax highlighting?
  const ext = filename.substring(filename.lastIndexOf(`.`) + 1);
  const syntax = {
    css: css,
    html: html,
    js: javascript,
    md: markdown,
  }[ext];
  if (syntax) extensions.push(syntax());

  // Add debounced content change syncing as a CM6 plugin
  extensions.push(
    EditorView.lineWrapping,
    EditorView.updateListener.of((e) => {
      const tab = e.view.tabElement;
      if (tab && e.docChanged) {
        const entry = fileEntry.state;
        const reset = entry.contentReset;
        // If we're already on a debounce schedule clear it
        // before we set the new debounce timeout.
        if (entry.debounce || reset) {
          clearTimeout(entry.debounce);
        }
        if (!reset) {
          entry.debounce = setTimeout(entry.sync, 1000);
        }
        entry.contentReset = false;

        // Do we need to "preserve" the scroll position?
        const { scrollPosition } = entry;
        if (scrollPosition) {
          setTimeout(() => {
            entry.view.dom.querySelector(`.cm-scroller`).scrollTop =
              scrollPosition;
          }, 0);
          delete entry.scrollPosition;
        }
      }
    }),
  );

  return EditorState.create({ doc, extensions });
}

/**
 * Set up a CodeMirror6 view
 */
export function setupView(parent, state) {
  const view = new EditorView({
    parent,
    state,
    lineWrapping: true,
  });
  return view;
}
