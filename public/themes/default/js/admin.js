// Add some protection to the delete buttons
document.querySelectorAll(`fieldset[disabled] button`).forEach((btn) => {
  let timer;
  btn.addEventListener(`pointerenter`, () => {
    btn.classList.add(`enabling`);
    timer = setTimeout(() => {
      btn.classList.remove(`enabling`);
      btn.classList.add(`enabled`);
      btn.parentNode.disabled = false;
    }, 2000);
  });
  btn.addEventListener(`pointerleave`, () => {
    btn.classList.remove(`enabling`, `enabled`);
    btn.parentNode.disabled = true;
    clearTimeout(timer);
  });
  btn.addEventListener(`click`, (evt) => {
    if (!confirm(`Are you sure?`)) return evt.preventDefault();
    if (!confirm(`There is no undeleting: are you REALLY sure?`))
      return evt.preventDefault();
  });
});
