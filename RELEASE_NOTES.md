# Release notes

## version 1.7 (14 October 2025)

Users can now load the starter projects in the editor like any other project, which also means they are now available as normal "project cards" on a logged in users's main page, rather than being a drop down selector. Starter project cards both link to the editor, and directly to the remix URL if users already know they want to remix it.

## version 1.6 (13 October, 2025)

This release adds extension-specific icons to the file tree, so that users can much more easily tell text files from programming source code, or images, etc. This uses the icons from https://www.npmjs.com/package/file-icon-vectors, made available through the MIT license.

## version 1.5 (12 October, 2025)

Projects in user profiles are, just like the main page, ordered in reverse chronological order based on "last updated" timestamp

## version 1.4 (12 October, 2025)

This version has no public-facing changes, instead improving the way containers start up, with fixes relating to debugging and testing those parts of the code base.

## version 1.3 (12 October, 2025)

Users can now reorder tabs in the editor, allowing in-browser ordering to match "best for work" ordering without having to open files in a specific order.

This release also includes CSP descriptor fixes that prevented some aspects of the editor from loading in Chrome, and a CSS tweak to make it visually obvious that a project is being loaded, even if it takes a while to bootstrap the associated container.

## version 1.2 (11 October, 2025)

The file tree can be persistently collapsed, allowing users to "queue up" the files they want to work on, and then slide the column divider for the file tree all the way to the left, hiding the file tree. Toggling between files using the tab navigation will leave the file tree collapsed, allowing for a "calmer" editor experience.

This release also fixes a typo in the basic html starter project.

## version 1.1 (11 October, 2025)

This release has no public-facing changes, and is instead a refactor of the client-side code that handles creating and toggling editors for files, allowing for easier future development, and paying off tech debt.

## verion 1.0 (undated)

This was an untagged release. All platform changes in this and older versions are commit based, rather than being versioned.
