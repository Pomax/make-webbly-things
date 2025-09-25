// This test script uses Codemirror v6
import { basicSetup, EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";

// Language-specific features:
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
// See https://github.com/orgs/codemirror/repositories?q=lang for more options

const editable = !!document.body.dataset.projectMember;

/**
 * Create an initial CodeMirror6 state object
 */
export function getInitialState(fileEntry, filename, data) {
  const entry = fileEntry.state;
  const doc = data.toString();
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
  entry.setEditable = (b) => {
    const newValue = readOnly.of(!b);
    const update = readOnlyCompartment.reconfigure(newValue);
    entry.view.dispatch({ effects: update });
  };

  // Can we add syntax highlighting? At least that's normal.
  // Provided we don't want to dynamically load any additional
  // ones later on, based on whether user needs them or not.
  const ext = filename.substring(filename.lastIndexOf(`.`) + 1);
  const syntax = {
    css: css,
    html: html,
    js: javascript,
    md: markdown,
  }[ext];
  if (syntax) extensions.push(syntax());

  // Then we have to manually add debounced content change
  // syncing, as a CM6 plugin, because CM6 has nothing built
  // in to trigger changes only "with enough content for that
  // to be a meaningful thing", instead firing for every input.
  extensions.push(
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
      }
    }),
  );

  // Thank god, we're done.
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
