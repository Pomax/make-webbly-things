const edit = document.querySelector(`button.show-edit`);
const presentation = document.querySelector(`section.presentation`);
const editForm = document.querySelector(`section.edit-form`);

(function setup() {
  if (!edit || !presentation || !editForm) return;

  const removeLinks = [];

  // hook up toggle
  edit.addEventListener(`click`, () => {
    presentation.classList.toggle(`hidden`);
    editForm.classList.toggle(`hidden`);
  });

  // hook up links add/remove buttons
  const addLink = editForm.querySelector(`input.add-link`);
  const linkList = editForm.querySelector(`ul.links`);
  addLink?.addEventListener(`click`, () => {
    const li = document.createElement(`li`);
    li.innerHTML = `
      <input type="text" name="linkNames" placeholder="Link name here" />
      <input type="url" name="linkHrefs" placeholder="URL goes here" />
      <input type="hidden" name="linkOrder" value="-1"/>
      <input type="button" class="remove-link" value="remove" />
    `;
    linkList.appendChild(li);
    li.querySelector(`input.remove-link`).addEventListener(`click`, () =>
      li.remove()
    );
  });

  linkList.querySelectorAll(`input.remove-link`).forEach((btn) => {
    btn.addEventListener(`click`, () => {
      const li = btn.closest(`li`);
      removeLinks.push(li);
      li.remove();
    });
  });

  // TODO: add link ordering

  // hook up cancel button
  const cancel = editForm.querySelector(`input[type="reset"]`);
  cancel?.addEventListener(`click`, () => {
    while (removeLinks.length) {
      linkList.appendChild(removeLinks.shift());
    }
    edit.click();
  });
})();
