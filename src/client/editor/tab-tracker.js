const TABS_BEFORE_POPUP = 5;
export class TabTracker {
  constructor(editor) {
    this.editor = editor;
    this.lastFiveKeys = [];
  }

  get full() {
    return this.lastFiveKeys.length >= TABS_BEFORE_POPUP;
  }

  get allTabs() {
    return this.lastFiveKeys.every((key) => key === 'Tab')
  }

  initialize() {
    this.editor.addEventListener(
      'keydown',
      this.showEscapeMessageOnRepeatedTab
    );
  }

  showEscapeMessageOnRepeatedTab = (event) => {
    if (this.full) {
      this.lastFiveKeys.shift();
    }

    this.lastFiveKeys.push(event.key);

    if (this.full && this.allTabs) {
      alert('In order to tab out of the editor, press escape first.');
      this.lastFiveKeys = [];
    }
  };
}
