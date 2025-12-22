// This test script uses Codemirror v6
import { basicSetup, EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { insertTab, indentLess } from "@codemirror/commands";

// Language-specific features:
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
// See https://github.com/orgs/codemirror/repositories?q=lang for more options

import { Notice, createOneTimeNotice } from "../utils/notifications";

const editable = !!document.body.dataset.projectMember;
const INDENT_STRING = `  `;

/**
 * ...
 * @returns
 */
function addTabHandling(extensions) {
  let bypassTabs = false;

  const TAB_NOTICE_TEXT = `Using tab for code indentation. To tab out of the editor, press escape first.`;

  extensions.push(
    // FIXME: CM6 seems to be ignoring this entirely... See the following forum post:
    //        https://discuss.codemirror.net/t/bug-in-commands-inserttab/9623
    indentUnit.of(INDENT_STRING),
    EditorState.tabSize.of(INDENT_STRING.length),
    // This part works, though.
    keymap.of([
      {
        key: `Escape`,
        run: () => {
          bypassTabs = true;
          new Notice(
            `Escaping the editor: pressing tab will now focus on the next focusable element on the page.`,
          );
        },
      },
      {
        key: `Tab`,
        preventDefault: true,
        run: (view) => {
          if (bypassTabs) return (bypassTabs = false);
          createOneTimeNotice(TAB_NOTICE_TEXT, 5000);
          return insertTab(view);
        },
      },
      {
        key: `Shift-Tab`,
        preventDefault: true,
        run: (view) => {
          if (bypassTabs) return (bypassTabs = false);
          createOneTimeNotice(TAB_NOTICE_TEXT, 5000);
          return indentLess(view);
        },
      },
    ]),
  );
}

/**
 * Create an initial CodeMirror6 state object
 */
export function getInitialState(editorEntry, doc) {
  const { fileEntry } = editorEntry;
  const { path } = fileEntry;
  const fileExtension = path.substring(path.lastIndexOf(`.`) + 1);

  // Our list of codemirror extensions:
  const extensions = [basicSetup, EditorView.lineWrapping];

  // We want to be able to toggle the editable state of our
  // editor, so we need to do some truly mad things here.
  // First we need to get the readOnly facet of the editor,
  const readOnly = EditorState.readOnly;

  // And then we need to make a "compartment" that acts
  // as the controller for that facet:
  const readOnlyCompartment = new Compartment();

  // Then we bootstrap the readOnly state using that compartment:
  extensions.push(readOnlyCompartment.of(readOnly.of(!editable)));

  // And then we need to set up a function for dispatching
  // updates that reconfigure the compartment, as a "visual
  // effect" update. That's an insane way to go about this.
  editorEntry.setEditable = (b) => {
    const newValue = readOnly.of(!b);
    const update = readOnlyCompartment.reconfigure(newValue);
    editorEntry.view.dispatch({ effects: update });
  };

  // Can we add syntax highlighting? At least that's normal.
  // Provided we don't want to dynamically load any additional
  // ones later on, based on whether user needs them or not.
  const syntax = {
    css: css,
    html: html,
    js: javascript,
    md: markdown,
  }[fileExtension];
  if (syntax) extensions.push(syntax());

  // Then we have to manually add debounced content change
  // syncing, as a CM6 plugin, because CM6 has nothing built
  // in to trigger changes only "with enough content for that
  // to be a meaningful thing", instead firing for every input.
  extensions.push(
    EditorView.updateListener.of((e) => {
      if (e.view !== editorEntry.view) return;
      if (!e.docChanged) return;
      const reset = editorEntry.contentReset;
      // If we're already on a debounce schedule clear it
      // before we set the new debounce timeout.
      if (editorEntry.debounce || reset) {
        clearTimeout(editorEntry.debounce);
      }
      if (!reset) {
        editorEntry.debounce = setTimeout(() => editorEntry.sync(), 1000);
      }
      editorEntry.contentReset = false;
    }),
  );

  // Make sure tabs are handled correctly
  addTabHandling(extensions);

  // Thank god, we're done.
  return EditorState.create({ doc, extensions });
}

/**
 * Set up a CodeMirror6 view
 */
export function setupView(editorEntry, data) {
  const view = new EditorView({
    parent: editorEntry.editor,
    state: getInitialState(editorEntry, data),
    lineWrapping: true,
  });

  document.addEventListener(`layout:resize`, () => view.requestMeasure());

  return view;
}
