const edit = document.querySelector(`button.show-edit`);
const presentation = document.querySelector(`section.presentation`);
const editForm = document.querySelector(`section.edit-form`);
const generateSection = document.querySelector(`.generate-direct-login`);
const generate = document.querySelector(`.generate`);
const projects = document.querySelector(`section#projects`);

(function setup() {
  if (generate) {
    generate.addEventListener(`click`, async () => {
      const response = await fetch(`/auth/personal/link`);
      const directLogin = await response.json();
      const { password, url } = directLogin ?? {};

      if (!password) return;
      if (!url) return;

      const passwordField = document.querySelector(`.auth-password`);
      passwordField.value = password;

      const urlField = document.querySelector(`.auth-url`);
      urlField.value = url;
      urlField.focus();
      urlField.select();
    });
  }

  if (!edit || !presentation || !editForm) return;

  const removeLinks = [];

  // hook up toggle
  edit.addEventListener(`click`, () => {
    [projects, presentation, generateSection].forEach((e) =>
      e?.classList.toggle(`hidden`, true)
    );
    editForm.classList.toggle(`hidden`, false);
    edit.disabled = true;
    editForm.querySelector(`fieldset:first-child`).scrollIntoView();
    editForm.querySelector(`[type="reset"]`).addEventListener(`click`, () => {
      edit.disabled = false;
      editForm.classList.toggle(`hidden`, true);
      [projects, presentation, generateSection].forEach((e) =>
        e?.classList.toggle(`hidden`, false)
      );
    });
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
