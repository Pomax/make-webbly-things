const TABS_BEFORE_POPUP = 5;
export class TabTracker {
  constructor(editor, tabsBeforePopup = TABS_BEFORE_POPUP) {
    this.editor = editor;
    this.mostRecentKeys = [];
    this.maxTabCount = tabsBeforePopup;
  }

  get full() {
    return this.mostRecentKeys.length >= this.maxTabCount;
  }

  get allTabs() {
    return this.mostRecentKeys.every((key) => key === 'Tab')
  }

  initialize() {
    this.editor.addEventListener(
      'keydown',
      this.showEscapeMessageOnRepeatedTab
    );
  }

  showEscapeMessageOnRepeatedTab = (event) => {
    if (this.full) {
      this.mostRecentKeys.shift();
    }

    this.mostRecentKeys.push(event.key);

    if (this.full && this.allTabs) {
      alert('In order to tab out of the editor, press escape first.');
      this.mostRecentKeys = [];
    }
  };
}
