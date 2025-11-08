// This test script uses Codemirror v6
import { basicSetup, EditorView } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

// Language-specific features:
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { javascript } from '@codemirror/lang-javascript';
// See https://github.com/orgs/codemirror/repositories?q=lang for more options

const editable = !!document.body.dataset.projectMember;

/**
 * Create an initial CodeMirror6 state object
 */
export function getInitialState(editorEntry, doc) {
  const { fileEntry } = editorEntry;
  const { path } = fileEntry;
  const fileExtension = path.substring(path.lastIndexOf(`.`) + 1);

  // Our list of codemirror extensions:
  const extensions = [
    basicSetup,
    EditorView.lineWrapping,
    keymap.of([indentWithTab]),
  ];

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
    })
  );

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

  // unsure where to put yet
  const tabTracker = new TabTracker(editorEntry.editor);

  editorEntry.editor.addEventListener('keydown', (event) => {
    tabTracker.showEscapeMessageOnRepeatedTab(event);
  });

  return view;
}

class TabTracker {
  static TABS_BEFORE_POPUP = 5;

  constructor(editor) {
    this.editor = editor;
    this.lastFiveKeys = [];
  }

  clearKeys() {
    this.lastFiveKeys = [];
  }

  showEscapeMessageOnRepeatedTab = (event) => {
    if (this.lastFiveKeys.length === TabTracker.TABS_BEFORE_POPUP) {
      this.lastFiveKeys.shift();
    }

    this.lastFiveKeys.push(event.key);

    if (this.fullOfTabs()) {
      alert('hey press escape');
      this.lastFiveKeys = [];
    } else {
      console.log('not a tab key');
    }

    console.debug('after', this.lastFiveKeys);
  };

  get full() {
    return this.lastFiveKeys.length >= TabTracker.TABS_BEFORE_POPUP;
  }

  fullOfTabs() {
    return this.full && this.lastFiveKeys.every((key) => key === 'Tab');
  }
}
