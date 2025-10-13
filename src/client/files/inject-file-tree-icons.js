const fileTree = document.querySelector(`file-tree`);
const extensions = [];
const style = document.createElement(`style`);
document.querySelector(`head`).appendChild(style);

function updateCSS() {
  const base = `file-tree {
  dir-entry {
    file-entry {
      &[extension]:has(.icon) {
        .icon {
          background-image: url("/themes/default/images/icons/default.svg");
          background-size: 100% 100%;
          &:before {
            content: " ";
          }
        }
        ${extensions
          .map(
            (ext) => `
        &[extension="${ext}"] .icon {
          background-image: url("/themes/default/images/icons/classic/${ext}.svg"), url("/themes/default/images/icons/default.svg");
        }`,
          )
          .join(``)}
      }
    }
  }
}`;
  style.textContent = base;
}

export function supportFileExtension(extension) {
  if (extensions.indexOf(extension) >= 0) return;
  extensions.push(extension);
  updateCSS();
}
