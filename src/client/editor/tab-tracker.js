const TABS_BEFORE_POPUP = 5;
export class TabTracker {
  constructor(editor) {
    this.editor = editor;
    this.lastFiveKeys = [];
  }

  get full() {
    return this.lastFiveKeys.length >= TABS_BEFORE_POPUP;
  }

  initialize() {
    this.editor.addEventListener('keydown', (event) => {
      this.showEscapeMessageOnRepeatedTab(event);
    });
  }

  clearKeys() {
    this.lastFiveKeys = [];
  }

  fullOfTabs() {
    return this.full && this.lastFiveKeys.every((key) => key === 'Tab');
  }

  showEscapeMessageOnRepeatedTab = (event) => {
    if (this.full) {
      this.lastFiveKeys.shift();
    }

    this.lastFiveKeys.push(event.key);

    if (this.fullOfTabs()) {
      alert('In order to tab out of the editor, press escape first.');
      this.lastFiveKeys = [];
    }
  };
}
