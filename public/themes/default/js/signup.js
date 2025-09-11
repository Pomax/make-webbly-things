const signup = document.getElementById(`signup`);

(function processSignupForm() {
  if (!signup) return;

  const name = signup.querySelector(`input`);
  const notice = signup.querySelector(`span`);

  name.addEventListener(`input`, async () => {
    signup.setAttribute(`action`, ``);

    const username = name.value;
    const error = username.trim()
      ? `That username is already taken.`
      : `Invalid username`;
    const url = `/v1/users/signup/${username}`;
    const flag = await fetch(url).then((r) => r.text());

    const available = flag === `true`;
    signup.dataset.action = available ? url : ``;
    notice.textContent = available ? `` : error;
    name.classList.toggle(`taken`, !available);
    providers.forEach((submit) => (submit.disabled = !available));
  });

  const providers = [...document.querySelectorAll(`button.provider`)].map(
    (submit) => {
      submit.addEventListener(`click`, () => {
        signup.action = `${signup.dataset.action}/${submit.dataset.name}`;
      });
      return submit;
    }
  );
})();
