const TABS_BEFORE_POPUP = 5;
export class TabTracker {

  constructor(editor) {
    this.editor = editor;
    this.lastFiveKeys = [];
  }

  get full() {
    return this.lastFiveKeys.length >= TABS_BEFORE_POPUP;
  }

  clearKeys() {
    this.lastFiveKeys = [];
  }

  fullOfTabs() {
    return this.full && this.lastFiveKeys.every((key) => key === 'Tab');
  }

  showEscapeMessageOnRepeatedTab = (event) => {
    console.debug('in the function call')
    console.debug('before', this.lastFiveKeys)
    if (this.full) {
      this.lastFiveKeys.shift();
    }

    this.lastFiveKeys.push(event.key);

    if (this.fullOfTabs()) {
      alert('In order to tab out of the editor, press escape first.');
      this.lastFiveKeys = [];
    }

    console.debug('after', this.lastFiveKeys)
  };
}
