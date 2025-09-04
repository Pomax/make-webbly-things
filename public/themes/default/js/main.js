/**
 * Hook up the "create project" button
 */
const create = document.getElementById(`create-project-form`);
const starter = create?.querySelector(`select`);
const description = create?.querySelector(`.description`);
const button = create?.querySelector(`button`);

if (starter && button) {
  create.querySelectorAll(`[disabled]`).forEach((e) => (e.disabled = false));
  const createProject = async (evt) => {
    const starterName = starter.value || `empty`;
    if (confirm(`Create new ${starterName} project ?`)) {
      const newName = prompt(
        `New project name? (leave blank for a default name)`
      ).trim();
      const response = await fetch(
        `/v1/projects/remix/${starterName}${newName ? `/${newName}` : ``}`
      );
      location = response.url;
    }
  };
  button.addEventListener(`click`, createProject);
  function setDescription() {
    const opt = starter.selectedOptions[0];
    const desc = opt.dataset?.description.trim();
    if (desc) description.textContent = `(${desc})`;
  }
  starter.addEventListener(`change`, setDescription);
  setDescription();

  /**
   * Hook up the "delete project" buttons
   */
  Array.from(document.querySelectorAll(`button.delete-project`)).forEach(
    (e) => {
      const { projectName } = e.dataset;
      e.addEventListener(`click`, async () => {
        if (confirm(`Are you sure you want to delete "${projectName}"?`)) {
          if (confirm(`No really: there is NO undelete. ARE YOU SURE?`)) {
            await fetch(`/v1/projects/delete/${projectName}`, {
              method: `POST`,
            });
            location.reload();
          }
        }
      });
    }
  );

  /**
   * Hook up the "edit project" buttons
   */
  Array.from(document.querySelectorAll(`button.edit-project-settings`)).forEach((e) => {
    const { projectId } = e.dataset;
    e.addEventListener(`click`, async () => {
      showEditDialog(projectId);
    });
  });
}
