/**
 * Hook up the "delete project" buttons
 */
Array.from(document.querySelectorAll(`button.delete-project`)).forEach((e) => {
  const { projectSlug } = e.dataset;
  e.addEventListener(`click`, async () => {
    if (confirm(`Are you sure you want to delete "${projectSlug}"?`)) {
      if (confirm(`No really: there is NO undelete. ARE YOU SURE?`)) {
        await fetch(`/v1/projects/delete/${projectSlug}`, {
          method: `POST`,
        });
        location.reload();
      }
    }
  });
});

/**
 * Hook up the "edit project" buttons
 */
Array.from(document.querySelectorAll(`button.edit-project-settings`)).forEach(
  (e) => {
    const { projectId } = e.dataset;
    e.addEventListener(`click`, async () => {
      showEditDialog(projectId);
    });
  }
);
